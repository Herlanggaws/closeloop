package storage

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

type FSStore struct {
	Root string
	Base string
}

func NewFS(root, apiURL string) *FSStore {
	_ = os.MkdirAll(root, 0o755)
	return &FSStore{Root: root, Base: apiURL}
}

func (s *FSStore) NewKey(projectID, kind string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return filepath.ToSlash(filepath.Join(projectID, kind, fmt.Sprintf("%d_%s", time.Now().UnixNano(), hex.EncodeToString(b))))
}

func (s *FSStore) NewUploadToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *FSStore) UploadURL(attachmentID, token string) string {
	return fmt.Sprintf("%s/v1/ingest/attachments/%s/upload?token=%s", s.Base, attachmentID, token)
}

func (s *FSStore) SignedReadURL(key string, ttl time.Duration) (string, error) {
	token := s.NewUploadToken()
	metaPath := filepath.Join(s.Root, ".tokens", token)
	_ = os.MkdirAll(filepath.Dir(metaPath), 0o755)
	expires := time.Now().Add(ttl).Unix()
	if err := os.WriteFile(metaPath, []byte(fmt.Sprintf("%s\n%d", key, expires)), 0o600); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/v1/files/%s", s.Base, token), nil
}

func (s *FSStore) ResolveReadToken(token string) (string, error) {
	body, err := os.ReadFile(filepath.Join(s.Root, ".tokens", token))
	if err != nil {
		return "", err
	}
	var key string
	var exp int64
	if _, err := fmt.Sscanf(string(body), "%s\n%d", &key, &exp); err != nil {
		lines := splitLines(string(body))
		if len(lines) < 2 {
			return "", fmt.Errorf("invalid token")
		}
		key = lines[0]
		fmt.Sscanf(lines[1], "%d", &exp)
	}
	if time.Now().Unix() > exp {
		return "", fmt.Errorf("expired")
	}
	return key, nil
}

func (s *FSStore) Put(key string, r io.Reader) (int64, error) {
	path := filepath.Join(s.Root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return 0, err
	}
	f, err := os.Create(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	return io.Copy(f, r)
}

func (s *FSStore) Open(key string) (*os.File, error) {
	return os.Open(filepath.Join(s.Root, filepath.FromSlash(key)))
}

func splitLines(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}
