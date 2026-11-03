package tools

import (
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

type transferBody struct {
	remaining int
	read      int
	closed    bool
}

func (b *transferBody) Read(p []byte) (int, error) {
	if b.remaining == 0 {
		return 0, io.EOF
	}

	n := min(len(p), b.remaining)
	clear(p[:n])
	b.remaining -= n
	b.read += n

	return n, nil
}

func (b *transferBody) Close() error {
	b.closed = true

	return nil
}

type transferHTTPClient struct {
	response *http.Response
}

func (c transferHTTPClient) Do(_ *http.Request) (*http.Response, error) {
	return c.response, nil
}

func TestStorageCallReadLimit(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		contentLength int64
		download      bool
		bodyBytes     int
		wantRead      int
		wantError     bool
	}{
		{
			"known oversized download",
			maxStorageTransferBytes + 1,
			true,
			maxStorageTransferBytes * 2,
			0,
			true,
		},
		{
			"unknown length download",
			-1,
			true,
			maxStorageTransferBytes * 2,
			maxStorageTransferBytes + 1,
			true,
		},
		{
			"understated download length",
			1,
			true,
			maxStorageTransferBytes * 2,
			maxStorageTransferBytes + 1,
			true,
		},
		{
			"known oversized non-download",
			maxStorageTransferBytes + 1,
			false,
			maxStorageTransferBytes * 2,
			0,
			true,
		},
		{
			"unknown length non-download",
			-1,
			false,
			maxStorageTransferBytes * 2,
			maxStorageTransferBytes + 1,
			true,
		},
		{
			"exact limit download",
			maxStorageTransferBytes,
			true,
			maxStorageTransferBytes,
			maxStorageTransferBytes,
			false,
		},
		{
			"exact limit unknown length",
			-1,
			true,
			maxStorageTransferBytes,
			maxStorageTransferBytes,
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body := &transferBody{remaining: tt.bodyBytes}
			tool := &storageTool{
				endpoint: "http://storage.example/v1",
				client: transferHTTPClient{response: &http.Response{
					StatusCode:    http.StatusOK,
					Header:        http.Header{},
					ContentLength: tt.contentLength,
					Body:          body,
				}},
			}

			result, err := tool.call(
				t.Context(),
				http.MethodGet,
				"/files/id",
				nil,
				nil,
				nil,
				tt.download,
			)
			if err != nil {
				t.Fatal(err)
			}

			if result.IsError != tt.wantError {
				t.Errorf("IsError=%v, want %v", result.IsError, tt.wantError)
			}

			if body.read != tt.wantRead || !body.closed {
				t.Errorf(
					"read %d bytes, closed=%v; want %d bytes and closed body",
					body.read,
					body.closed,
					tt.wantRead,
				)
			}
		})
	}
}

func TestValidateStorageUploadSize(t *testing.T) {
	t.Parallel()

	encoded := strings.Repeat("A", base64.StdEncoding.EncodedLen(maxStorageTransferBytes))
	atLimit := encoded[:len(encoded)-2] + "=="
	tests := []struct {
		name    string
		files   []storageFile
		wantErr bool
	}{
		{"empty file", []storageFile{{Data: ""}}, false},
		{"two padding bytes at limit", []storageFile{{Data: atLimit}}, false},
		{
			"one padding byte exceeds limit",
			[]storageFile{{Data: encoded[:len(encoded)-1] + "="}},
			true,
		},
		{"unpadded file exceeds limit", []storageFile{{Data: encoded}}, true},
		{"batch at limit", []storageFile{{Data: atLimit[:len(atLimit)-4]}, {Data: "AA=="}}, false},
		{"batch exceeds limit", []storageFile{{Data: atLimit}, {Data: "AA=="}}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			err := validateStorageUploadSize(tt.files)
			if errors.Is(err, errStorageSize) != tt.wantErr {
				t.Errorf("size error=%v, want error=%v", err, tt.wantErr)
			}
		})
	}
}

func TestStorageUploadSizePreflight(t *testing.T) {
	t.Parallel()

	oversized := strings.Repeat("A", base64.StdEncoding.EncodedLen(maxStorageTransferBytes+1))
	tests := []struct {
		name  string
		files []storageFile
	}{
		{
			name: "batch rejected before decoding any files",
			files: []storageFile{
				{Name: "invalid", Data: "%%%"},
				{Name: "large", Data: oversized},
			},
		},
		{
			name: "batch rejected before constructing multipart",
			files: []storageFile{
				{Name: "", Data: "AAAA"},
				{Name: "large", Data: oversized},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			tool := &storageTool{}

			result, err := tool.handleUpload(
				t.Context(),
				mcp.CallToolRequest{},
				storageUploadRequest{Files: tt.files},
			)
			if err != nil || !result.IsError {
				t.Fatalf("expected size error, got %v, %+v", err, result)
			}

			text, ok := result.Content[0].(mcp.TextContent)
			if !ok || !strings.Contains(text.Text, "size limit") {
				t.Errorf("expected size preflight before file validation, got %+v", result.Content)
			}
		})
	}
}
