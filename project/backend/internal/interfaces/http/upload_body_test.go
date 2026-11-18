package httpapi

import (
	"bytes"
	"encoding/base64"
	"io"
	"strings"
	"testing"
)

func TestDecodeAttachmentBodyRaw(t *testing.T) {
	in := []byte("fake-png-bytes")
	r, n, err := decodeAttachmentBody("application/octet-stream", bytes.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if n != int64(len(in)) {
		t.Fatalf("size %d", n)
	}
	out, _ := io.ReadAll(r)
	if !bytes.Equal(out, in) {
		t.Fatalf("got %q", out)
	}
}

func TestDecodeAttachmentBodyDataURL(t *testing.T) {
	payload := []byte{0x89, 0x50, 0x4e, 0x47, 1, 2, 3}
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(payload)
	body := `{"data_url":"` + dataURL + `"}`
	r, n, err := decodeAttachmentBody("application/json; charset=utf-8", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if n != int64(len(payload)) {
		t.Fatalf("size %d", n)
	}
	out, _ := io.ReadAll(r)
	if !bytes.Equal(out, payload) {
		t.Fatalf("got %v", out)
	}
}

func TestDecodeAttachmentBodyBase64Field(t *testing.T) {
	payload := []byte("shot")
	body := `{"data":"` + base64.StdEncoding.EncodeToString(payload) + `"}`
	r, n, err := decodeAttachmentBody("application/json", strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if n != 4 {
		t.Fatalf("size %d", n)
	}
	out, _ := io.ReadAll(r)
	if string(out) != "shot" {
		t.Fatalf("got %q", out)
	}
}

func TestDecodeAttachmentBodyJSONEmpty(t *testing.T) {
	_, _, err := decodeAttachmentBody("application/json", strings.NewReader(`{}`))
	if err == nil {
		t.Fatal("expected error")
	}
}
