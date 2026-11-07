package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	DatabaseURL        string
	JWTSecret          string
	StorageRoot        string
	APIURL             string
	WebURL             string
	APIAddr            string
	EmailFrom          string
	ResendKey          string
	GoogleClientID     string
	GoogleClientSecret string
}

func Load() Config {
	storage := env("STORAGE_ROOT", "./.data/uploads")
	if !filepath.IsAbs(storage) {
		if wd, err := os.Getwd(); err == nil {
			storage = filepath.Join(wd, storage)
		}
	}
	return Config{
		DatabaseURL:        env("DATABASE_URL", "postgres://localhost:5432/closeloop?sslmode=disable"),
		JWTSecret:          env("JWT_SECRET", "dev-jwt-secret-change-me-in-production"),
		StorageRoot:        storage,
		APIURL:             env("API_URL", "http://localhost:8080"),
		WebURL:             env("WEB_URL", "http://localhost:3000"),
		APIAddr:            env("API_ADDR", ":8080"),
		EmailFrom:          env("EMAIL_FROM", "Closeloop <noreply@closeloop.dev>"),
		ResendKey:          os.Getenv("RESEND_API_KEY"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
