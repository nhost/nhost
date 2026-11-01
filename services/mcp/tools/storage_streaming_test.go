package tools_test

import (
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestStorageTransfersAbovePreviousLimit(t *testing.T) {
	t.Parallel()

	const size = 5 << 20

	encoded := base64.StdEncoding.EncodeToString([]byte(strings.Repeat("x", size)))
	tests := []struct {
		tool string
		args map[string]any
	}{
		{
			"storage-upload",
			map[string]any{"files": []any{map[string]any{"name": "large.png", "data": encoded}}},
		},
		{
			"storage-update",
			map[string]any{
				"id":   "id",
				"file": map[string]any{"name": "large.png", "data": encoded},
			},
		},
		{"storage-download", map[string]any{"id": "id"}},
	}

	for _, tt := range tests {
		t.Run(tt.tool, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if tt.tool == "storage-download" {
						w.Header().Set("Content-Type", "image/png")

						if _, err := io.WriteString(w, strings.Repeat("x", size)); err != nil {
							t.Error(err)
						}

						return
					}

					checkStreamedUpload(t, r, size)
					w.Header().Set("Content-Type", "application/json")

					if _, err := io.WriteString(w, `{}`); err != nil {
						t.Error(err)
					}
				}),
			)
			t.Cleanup(srv.Close)

			result := callStorageTool(
				t,
				storageClientWithLimit(t, srv.URL, 50_000_000),
				tt.tool,
				tt.args,
			)
			if result.IsError {
				t.Fatalf("50 MB budget rejected a 5 MiB transfer: %+v", result.Content)
			}

			if tt.tool == "storage-download" {
				checkLargeDownloadedImage(t, result, encoded)
			}
		})
	}
}

func checkStreamedUpload(t *testing.T, r *http.Request, size int) {
	t.Helper()

	if r.ContentLength <= int64(size) || len(r.TransferEncoding) != 0 {
		t.Errorf(
			"multipart stream should retain a known Content-Length, got %d and %v",
			r.ContentLength,
			r.TransferEncoding,
		)
	}

	reader, err := r.MultipartReader()
	if err != nil {
		t.Error(err)
		return
	}

	files := 0
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			t.Error(err)
			return
		}

		length, err := io.Copy(io.Discard, part)
		if err != nil {
			t.Error(err)
		}

		if err := part.Close(); err != nil {
			t.Error(err)
		}

		if part.FileName() != "" {
			files++

			if length != int64(size) {
				t.Errorf("streamed file has %d bytes, want %d", length, size)
			}
		}
	}

	if files != 1 {
		t.Errorf("got %d files, want 1", files)
	}
}

func checkLargeDownloadedImage(t *testing.T, result *mcp.CallToolResult, encoded string) {
	t.Helper()

	images := 0
	for _, content := range result.Content {
		switch value := content.(type) {
		case mcp.ImageContent:
			images++

			if value.Data != encoded {
				t.Error("streamed download base64 differs from source bytes")
			}
		case mcp.TextContent:
			if len(value.Text) > 2048 {
				t.Error("image payload leaked into text summary")
			}
		}
	}

	if images != 1 {
		t.Errorf("got %d image blocks, want 1", images)
	}
}

func TestStorageMultipartPreflightRejectsLaterInvalidFile(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		t.Error("a batch containing an invalid file must not reach storage")
	}))
	t.Cleanup(srv.Close)

	result := callStorageTool(t, storageClient(t, srv.URL), "storage-upload", map[string]any{
		"files": []any{
			storageFileArgs(),
			map[string]any{"name": "bad.png", "data": "AA==trailing"},
		},
	})
	if !result.IsError {
		t.Fatal("invalid base64 in a later streamed part must be rejected before HTTP")
	}
}
