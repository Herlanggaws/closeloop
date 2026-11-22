package application

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestEncryptDecryptSecret(t *testing.T) {
	t.Setenv("INTEGRATION_ENCRYPTION_KEY", "super-secret-prod-key-32-chars!!")
	plain := "glpat-abc123xyz987"
	enc, err := EncryptSecret(plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if enc == plain || strings.Contains(enc, plain) {
		t.Fatalf("encrypted value leaked plaintext: %s", enc)
	}
	if !strings.HasPrefix(enc, encPrefix) {
		t.Fatalf("expected encPrefix, got %s", enc)
	}
	dec, err := DecryptSecret(enc)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if dec != plain {
		t.Fatalf("got %q, want %q", dec, plain)
	}
}

func TestConfigDecryptAndRedact(t *testing.T) {
	t.Setenv("INTEGRATION_ENCRYPTION_KEY", "super-secret-prod-key-32-chars!!")
	cleaned := map[string]any{
		"base_url": "https://gitlab.com",
		"token":    "glpat-secret-token",
	}
	if err := encryptConfigSecrets(cleaned); err != nil {
		t.Fatalf("encryptConfigSecrets: %v", err)
	}
	raw, _ := json.Marshal(cleaned)
	if strings.Contains(string(raw), "glpat-secret-token") {
		t.Fatalf("raw json should not contain plaintext token: %s", string(raw))
	}

	decrypted := decryptConfigJSON(raw)
	if !strings.Contains(string(decrypted), "glpat-secret-token") {
		t.Fatalf("decrypted json missing plaintext token: %s", string(decrypted))
	}

	redacted := redactConfigJSON(raw)
	if strings.Contains(string(redacted), "glpat-secret-token") || strings.Contains(string(redacted), encPrefix) {
		t.Fatalf("redacted json leaked secret: %s", string(redacted))
	}
	if !strings.Contains(string(redacted), RedactedToken) {
		t.Fatalf("redacted json missing placeholder: %s", string(redacted))
	}
}
