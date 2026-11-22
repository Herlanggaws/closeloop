package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/config"
	"github.com/closeloop/api/internal/infrastructure/db"
	"github.com/closeloop/api/internal/infrastructure/email"
	"github.com/closeloop/api/internal/infrastructure/githubapp"
	"github.com/closeloop/api/internal/infrastructure/storage"
	httpapi "github.com/closeloop/api/internal/interfaces/http"
	"github.com/joho/godotenv"
)

func main() {
	mode := flag.String("mode", "api", "api|worker|migrate|all")
	flag.Parse()

	_ = godotenv.Load()
	_ = godotenv.Load(".env")
	_ = godotenv.Load(filepath.Join("..", ".env"))

	cfg := config.Load()
	sqlDB, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer sqlDB.Close()

	migrations := filepath.Join("db", "migrations")
	if _, err := os.Stat(migrations); err != nil {
		migrations = filepath.Join("backend", "db", "migrations")
	}

	switch *mode {
	case "migrate":
		if err := db.Migrate(sqlDB, migrations); err != nil {
			log.Fatal(err)
		}
		log.Println("migrations complete")
		return
	}

	if err := db.Migrate(sqlDB, migrations); err != nil {
		log.Fatal(err)
	}

	store := &application.Store{DB: sqlDB}
	files := storage.NewFS(cfg.StorageRoot, cfg.APIURL)
	mailer := email.New(cfg.EmailFrom, cfg.ResendKey, cfg.StorageRoot)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var autoprExec application.AutoprExecutor
	if pem, err := githubapp.LoadPrivateKey([]byte(cfg.GitHubAppPrivateKey), cfg.GitHubAppPrivateKeyPath); err == nil {
		if gh, err := githubapp.New(githubapp.Config{
			AppID:         cfg.GitHubAppID,
			Slug:          cfg.GitHubAppSlug,
			WebhookSecret: cfg.GitHubAppWebhookSecret,
			PrivateKeyPEM: pem,
		}); err == nil {
			autoprExec = &application.GitHubAutoprExecutor{Client: gh}
		}
	}

	if *mode == "worker" || *mode == "all" {
		go application.RunWorker(ctx, store, mailer, files, cfg.WebURL, nil, autoprExec)
	}
	if *mode == "worker" {
		<-ctx.Done()
		return
	}

	srv := httpapi.New(cfg, store, files, mailer)
	r := srv.Router()
	httpServer := &http.Server{
		Addr:    cfg.APIAddr,
		Handler: r,
	}
	log.Printf("api listening on %s", cfg.APIAddr)
	go func() {
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
}
