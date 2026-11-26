package tools_test

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
)

type storageSizeCase struct {
	name          string
	contentLength bool
	ranged        bool
}

func TestStorageResponseSizeLimit(t *testing.T) {
	t.Parallel()

	const limit = 4 << 20

	tests := []storageSizeCase{
		{"oversized known length", true, false},
		{"oversized chunked", false, false},
		{"bounded range known length", true, true},
		{"bounded range chunked", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			length := limit + 1
			status := http.StatusOK

			args := map[string]any{"id": "large"}
			if tt.ranged {
				length = 1024
				status = http.StatusPartialContent
				args["range"] = "bytes=0-1023"
			}

			srv := storageSizeServer(t, tt, length, status)

			result := callStorageTool(t, storageClient(t, srv.URL), args)
			if result.IsError == tt.ranged {
				t.Fatalf("IsError=%v, want %v", result.IsError, !tt.ranged)
			}

			checkStorageSizeResponse(t, tt, result, length, status)
		})
	}
}

func storageSizeServer(t *testing.T, tt storageSizeCase, length, status int) *httptest.Server {
	t.Helper()

	const limit = 4 << 20

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if tt.ranged && r.Header.Get("Range") != "bytes=0-1023" {
			t.Error("range was not forwarded")
		}

		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Accept-Ranges", "bytes")
		w.Header().Set("ETag", `"large-etag"`)

		if tt.ranged {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes 0-1023/%d", limit+1))
		}

		if tt.contentLength {
			w.Header().Set("Content-Length", strconv.Itoa(length))
		}

		w.WriteHeader(status)

		if !tt.contentLength {
			if err := http.NewResponseController(w).Flush(); err != nil {
				t.Error(err)
				return
			}
		}

		if _, err := io.WriteString(w, strings.Repeat("x", length)); err != nil {
			// Oversized responses may be closed before the upstream finishes writing.
			t.Logf("upstream response closed: %v", err)
		}
	}))
	t.Cleanup(srv.Close)

	return srv
}

func checkStorageSizeResponse(
	t *testing.T,
	tt storageSizeCase,
	result *mcp.CallToolResult,
	length, status int,
) {
	t.Helper()

	data, err := json.Marshal(result.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}

	var response struct {
		StatusCode int         `json:"statusCode"`
		Headers    http.Header `json:"headers"`
		Body       string      `json:"body"`
		Data       *string     `json:"data"`
	}
	if err := json.Unmarshal(data, &response); err != nil {
		t.Fatal(err)
	}

	if response.StatusCode != status || response.Headers.Get("ETag") != `"large-etag"` ||
		response.Headers.Get("Accept-Ranges") != "bytes" {
		t.Errorf("lost upstream status or headers: %s", data)
	}

	if tt.contentLength && response.Headers.Get("Content-Length") != strconv.Itoa(length) {
		t.Error("lost Content-Length")
	}

	if tt.ranged {
		if response.Data == nil ||
			*response.Data != base64.StdEncoding.EncodeToString(
				[]byte(strings.Repeat("x", length)),
			) ||
			response.Headers.Get("Content-Range") != "bytes 0-1023/4194305" {
			t.Error("bounded range did not retain its data and Content-Range")
		}

		return
	}

	if response.Data != nil {
		t.Error("oversized download must not return truncated data")
	}

	for _, hint := range []string{"range", "bytes=0-4194303", "Omit transformations"} {
		if !strings.Contains(response.Body, hint) {
			t.Errorf("size error lacks %q guidance: %s", hint, data)
		}
	}
}
