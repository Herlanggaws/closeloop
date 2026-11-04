package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func Migrate(sqlDB *sql.DB, migrationsDir string) error {
	if _, err := sqlDB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`); err != nil {
		return err
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		var exists bool
		if err := sqlDB.QueryRow(`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, name).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		body, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			return err
		}
		up := extractUp(string(body))
		tx, err := sqlDB.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(up); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migrate %s: %w", name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations(filename) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		fmt.Println("applied", name)
	}
	return nil
}

func extractUp(sqlText string) string {
	parts := strings.Split(sqlText, "-- +goose Down")
	up := parts[0]
	up = strings.ReplaceAll(up, "-- +goose Up", "")
	return strings.TrimSpace(up)
}
