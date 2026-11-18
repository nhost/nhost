package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

func TestStorageRequestBodyLimit(t *testing.T) {
	t.Parallel()

	const initialize = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"test"}}}`

	padding := strings.Repeat(" ", maxStorageRequestBytes+1)
	tests := []struct {
		name          string
		enabled       bool
		size          int
		contentLength int64
		wantStatus    int
	}{
		{"small body", true, 1024, 1024, http.StatusOK},
		{"exact limit", true, maxStorageRequestBytes, maxStorageRequestBytes, http.StatusOK},
		{
			"oversized known length",
			true,
			maxStorageRequestBytes + 1,
			maxStorageRequestBytes + 1,
			http.StatusRequestEntityTooLarge,
		},
		{"oversized unknown length", true, maxStorageRequestBytes + 1, -1, http.StatusBadRequest},
		{"small unknown length", true, 1024, -1, http.StatusOK},
		{"storage disabled", false, maxStorageRequestBytes + 1, -1, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			mcpHTTP := mcpserver.NewStreamableHTTPServer(mcpserver.NewMCPServer("test", "test"))
			router.POST("/", storageRequestBodyLimit(tt.enabled), gin.WrapH(mcpHTTP))

			req := httptest.NewRequest(http.MethodPost, "/", io.MultiReader(
				strings.NewReader(initialize), strings.NewReader(padding[:tt.size-len(initialize)]),
			))
			req.ContentLength = tt.contentLength
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Accept", "application/json, text/event-stream")

			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Fatalf("status=%d, want %d: %s", w.Code, tt.wantStatus, w.Body.String())
			}

			if tt.wantStatus == http.StatusBadRequest &&
				!strings.Contains(w.Body.String(), "request body too large") {
				t.Errorf("missing unknown-length size error: %s", w.Body.String())
			}
		})
	}
}
