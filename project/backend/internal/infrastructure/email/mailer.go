package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type Mailer struct {
	From      string
	ResendKey string
	LogDir    string
}

func New(from, resendKey, storageRoot string) *Mailer {
	dir := filepath.Join(storageRoot, ".mail")
	_ = os.MkdirAll(dir, 0o755)
	return &Mailer{From: from, ResendKey: resendKey, LogDir: dir}
}

func (m *Mailer) Send(to, subject, html string) error {
	entry := map[string]any{
		"to":      to,
		"subject": subject,
		"html":    html,
		"at":      time.Now().Format(time.RFC3339),
	}
	b, _ := json.MarshalIndent(entry, "", "  ")
	name := filepath.Join(m.LogDir, fmt.Sprintf("%d.json", time.Now().UnixNano()))
	_ = os.WriteFile(name, b, 0o644)
	slog.Info("email queued", "to", to, "subject", subject, "file", name)

	if m.ResendKey == "" {
		return nil
	}
	payload := map[string]any{
		"from":    m.From,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.ResendKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("resend status %d", resp.StatusCode)
	}
	return nil
}
