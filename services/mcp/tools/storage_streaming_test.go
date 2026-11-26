package tools_test

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

func TestStorageDownloadAbovePreviousLimit(t *testing.T) {
	t.Parallel()

	const size = 5 << 20

	payload := strings.Repeat("x", size)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/png")

		if _, err := io.WriteString(w, payload); err != nil {
			t.Error(err)
		}
	}))
	t.Cleanup(srv.Close)

	result := callStorageTool(
		t, storageClientWithLimit(t, srv.URL, 50_000_000), map[string]any{"id": "id"},
	)
	if result.IsError {
		t.Fatalf("50 MB budget rejected a 5 MiB download: %+v", result.Content)
	}

	checkLargeDownloadedImage(t, result, base64.StdEncoding.EncodeToString([]byte(payload)))
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
