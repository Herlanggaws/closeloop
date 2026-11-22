package application

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
)

const (
	encPrefixV1 = "enc:v1:"
	encPrefix   = "enc:v2:"
	saltSize    = 16
	// RedactedToken is returned to HTTP/UI clients instead of the real credential.
	RedactedToken = "••••••••"
)

// integrationSecretFields lists JSON keys inside integrations.config that hold
// sensitive credentials and must be encrypted at rest and redacted in list responses.
var integrationSecretFields = []string{"token", "api_key", "api_token", "webhook_secret", "secret"}

var (
	ephemeralKeyOnce sync.Once
	ephemeralKey     []byte
)

func integrationMasterSecret() []byte {
	secret := strings.TrimSpace(os.Getenv("INTEGRATION_ENCRYPTION_KEY"))
	if secret == "" {
		secret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if secret == "" || secret == "dev-jwt-secret-change-me-in-production" {
		if os.Getenv("GIN_MODE") == "release" || os.Getenv("APP_ENV") == "production" {
			ephemeralKeyOnce.Do(func() {
				ephemeralKey = make([]byte, 32)
				_, _ = io.ReadFull(rand.Reader, ephemeralKey)
			})
			return ephemeralKey
		}
		if secret == "" {
			secret = "dev-jwt-secret-change-me-in-production"
		}
	}
	return []byte(secret)
}

func deriveSaltedKey(salt []byte) [32]byte {
	mac := hmac.New(sha256.New, integrationMasterSecret())
	mac.Write([]byte("saidloop:integration:v2:"))
	mac.Write(salt)
	var out [32]byte
	copy(out[:], mac.Sum(nil))
	return out
}

// EncryptSecret encrypts a plaintext credential using a random 16-byte salt,
// HMAC-SHA256 key derivation, and AES-256-GCM.
func EncryptSecret(plaintext string) (string, error) {
	if plaintext == "" || strings.HasPrefix(plaintext, encPrefix) || strings.HasPrefix(plaintext, encPrefixV1) {
		return plaintext, nil
	}
	salt := make([]byte, saltSize)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}
	key := deriveSaltedKey(salt)
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	payload := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	payload = append(payload, salt...)
	payload = append(payload, nonce...)
	payload = append(payload, ciphertext...)
	return encPrefix + base64.StdEncoding.EncodeToString(payload), nil
}

// DecryptSecret decrypts an "enc:v2:..." (salted) or "enc:v1:..." credential.
// Plaintext values without the prefix are returned as-is for backward compatibility.
func DecryptSecret(value string) (string, error) {
	if encoded, ok := strings.CutPrefix(value, encPrefix); ok {
		raw, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return "", fmt.Errorf("decode encrypted secret: %w", err)
		}
		if len(raw) < saltSize {
			return "", fmt.Errorf("encrypted secret missing salt")
		}
		salt := raw[:saltSize]
		rest := raw[saltSize:]
		key := deriveSaltedKey(salt)
		block, err := aes.NewCipher(key[:])
		if err != nil {
			return "", err
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return "", err
		}
		if len(rest) < gcm.NonceSize() {
			return "", fmt.Errorf("encrypted secret too short")
		}
		nonce, ciphertext := rest[:gcm.NonceSize()], rest[gcm.NonceSize():]
		plain, err := gcm.Open(nil, nonce, ciphertext, nil)
		if err != nil {
			return "", fmt.Errorf("decrypt secret: %w", err)
		}
		return string(plain), nil
	}

	if encoded, ok := strings.CutPrefix(value, encPrefixV1); ok {
		raw, err := base64.StdEncoding.DecodeString(encoded)
		if err != nil {
			return "", fmt.Errorf("decode encrypted secret: %w", err)
		}
		key := sha256.Sum256(integrationMasterSecret())
		block, err := aes.NewCipher(key[:])
		if err != nil {
			return "", err
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			return "", err
		}
		if len(raw) < gcm.NonceSize() {
			return "", fmt.Errorf("encrypted secret too short")
		}
		nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
		plain, err := gcm.Open(nil, nonce, ciphertext, nil)
		if err != nil {
			return "", fmt.Errorf("decrypt secret: %w", err)
		}
		return string(plain), nil
	}

	return value, nil
}

func encryptConfigSecrets(cleaned map[string]any) error {
	for _, field := range integrationSecretFields {
		if v, ok := cleaned[field].(string); ok && v != "" {
			enc, err := EncryptSecret(v)
			if err != nil {
				return err
			}
			cleaned[field] = enc
		}
	}
	return nil
}

func decryptConfigJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	changed := false
	for _, field := range integrationSecretFields {
		if v, ok := m[field].(string); ok && (strings.HasPrefix(v, encPrefix) || strings.HasPrefix(v, encPrefixV1)) {
			if plain, err := DecryptSecret(v); err == nil {
				m[field] = plain
				changed = true
			}
		}
	}
	if !changed {
		return raw
	}
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}

func redactConfigJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return raw
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	changed := false
	for _, field := range integrationSecretFields {
		if v, ok := m[field].(string); ok && v != "" {
			m[field] = RedactedToken
			changed = true
		}
	}
	if !changed {
		return raw
	}
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	return out
}
