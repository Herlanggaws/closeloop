package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/closeloop/api/internal/infrastructure/polar"
)

type Config struct {
	DatabaseURL             string
	JWTSecret               string
	StorageRoot             string
	APIURL                  string
	WebURL                  string
	APIAddr                 string
	EmailFrom               string
	ResendKey               string
	GoogleClientID          string
	GoogleClientSecret      string
	GitHubAppID             string
	GitHubAppSlug           string
	GitHubAppWebhookSecret  string
	GitHubAppPrivateKey     string
	GitHubAppPrivateKeyPath string
	AnthropicAPIKey         string
	SlackClientID           string
	SlackClientSecret       string
	SlackAPIBase            string // https://slack.com unless overridden (tests)
	PolarAccessToken        string
	PolarWebhookSecret      string
	PolarAPIBase            string // from POLAR_SERVER; empty when that value is invalid
	PolarProducts           polar.Products
}

func Load() Config {
	storage := env("STORAGE_ROOT", "./.data/uploads")
	if !filepath.IsAbs(storage) {
		if wd, err := os.Getwd(); err == nil {
			storage = filepath.Join(wd, storage)
		}
	}
	return Config{
		DatabaseURL:             env("DATABASE_URL", "postgres://localhost:5432/closeloop?sslmode=disable"),
		JWTSecret:               env("JWT_SECRET", "dev-jwt-secret-change-me-in-production"),
		StorageRoot:             storage,
		APIURL:                  env("API_URL", "http://localhost:8080"),
		WebURL:                  env("WEB_URL", "http://localhost:3000"),
		APIAddr:                 env("API_ADDR", ":8080"),
		EmailFrom:               env("EMAIL_FROM", "Saidloop <noreply@saidloop.dev>"),
		ResendKey:               os.Getenv("RESEND_API_KEY"),
		GoogleClientID:          os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:      os.Getenv("GOOGLE_CLIENT_SECRET"),
		GitHubAppID:             os.Getenv("GITHUB_APP_ID"),
		GitHubAppSlug:           env("GITHUB_APP_SLUG", "saidloop-auto-pr"),
		GitHubAppWebhookSecret:  os.Getenv("GITHUB_APP_WEBHOOK_SECRET"),
		GitHubAppPrivateKey:     os.Getenv("GITHUB_APP_PRIVATE_KEY"),
		GitHubAppPrivateKeyPath: os.Getenv("GITHUB_APP_PRIVATE_KEY_PATH"),
		SlackClientID:           os.Getenv("SLACK_CLIENT_ID"),
		SlackClientSecret:       os.Getenv("SLACK_CLIENT_SECRET"),
		SlackAPIBase:            env("SLACK_API_BASE", "https://slack.com"),
		AnthropicAPIKey:         os.Getenv("ANTHROPIC_API_KEY"),
		PolarAccessToken:        trimmedEnv("POLAR_ACCESS_TOKEN"),
		PolarWebhookSecret:      trimmedEnv("POLAR_WEBHOOK_SECRET"),
		PolarAPIBase:            polar.BaseURL(os.Getenv("POLAR_SERVER")),
		PolarProducts: polar.Products{
			IndieMonthly:  trimmedEnv("POLAR_PRODUCT_INDIE_MONTHLY"),
			IndieYearly:   trimmedEnv("POLAR_PRODUCT_INDIE_YEARLY"),
			StudioMonthly: trimmedEnv("POLAR_PRODUCT_STUDIO_MONTHLY"),
			StudioYearly:  trimmedEnv("POLAR_PRODUCT_STUDIO_YEARLY"),
		},
	}
}

func trimmedEnv(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
