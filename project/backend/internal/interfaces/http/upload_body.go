package httpapi

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"strings"

	"github.com/closeloop/api/internal/application"
)

// decodeAttachmentBody accepts raw binary (legacy) or JSON:
// {"data":"<base64>"} (preferred; avoids WAF rules that match "image/png")
// or {"data_url":"data:...;base64,..."}.
func decodeAttachmentBody(contentType string, r io.Reader) (io.Reader, int64, error) {
	ct := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if ct != "application/json" {
		raw, err := io.ReadAll(r)
		if err != nil {
			return nil, 0, err
		}
		return bytes.NewReader(raw), int64(len(raw)), nil
	}

	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, 0, err
	}
	var payload struct {
		DataURL string `json:"data_url"`
		Data    string `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, 0, application.ErrInvalidInput
	}

	var decoded []byte
	switch {
	case payload.DataURL != "":
		decoded, err = decodeDataURL(payload.DataURL)
	case payload.Data != "":
		decoded, err = base64.StdEncoding.DecodeString(payload.Data)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(payload.Data)
		}
	default:
		return nil, 0, application.ErrInvalidInput
	}
	if err != nil {
		return nil, 0, application.ErrInvalidInput
	}
	return bytes.NewReader(decoded), int64(len(decoded)), nil
}

func decodeDataURL(dataURL string) ([]byte, error) {
	const marker = ";base64,"
	_, rest, ok := strings.Cut(dataURL, marker)
	if !ok || !strings.HasPrefix(dataURL, "data:") {
		return nil, application.ErrInvalidInput
	}
	return base64.StdEncoding.DecodeString(rest)
}
