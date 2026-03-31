package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestIsBrowserRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		method   string
		accept   string
		expected bool
	}{
		{
			name:     "browser GET with text/html",
			method:   http.MethodGet,
			accept:   "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			expected: true,
		},
		{
			name:     "browser GET with just text/html",
			method:   http.MethodGet,
			accept:   "text/html",
			expected: true,
		},
		{
			name:     "MCP client POST with application/json",
			method:   http.MethodPost,
			accept:   "application/json",
			expected: false,
		},
		{
			name:     "MCP client GET with no accept header",
			method:   http.MethodGet,
			accept:   "",
			expected: false,
		},
		{
			name:     "MCP client GET with application/json",
			method:   http.MethodGet,
			accept:   "application/json",
			expected: false,
		},
		{
			name:     "POST with text/html is not browser",
			method:   http.MethodPost,
			accept:   "text/html",
			expected: false,
		},
		{
			name:     "DELETE with text/html is not browser",
			method:   http.MethodDelete,
			accept:   "text/html",
			expected: false,
		},
		{
			name:     "MCP client GET with text/event-stream",
			method:   http.MethodGet,
			accept:   "text/event-stream",
			expected: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(tc.method, "/", nil)
			if tc.accept != "" {
				req.Header.Set("Accept", tc.accept)
			}

			got := IsBrowserRequest(req)
			if got != tc.expected {
				t.Errorf(
					"IsBrowserRequest() = %v, want %v (method=%s, accept=%s)",
					got, tc.expected, tc.method, tc.accept,
				)
			}
		})
	}
}

func TestBrowserRedirectMiddleware(t *testing.T) { //nolint:cyclop
	t.Parallel()

	gin.SetMode(gin.TestMode)

	t.Run("default HTML when no path configured", func(t *testing.T) {
		t.Parallel()

		handler := browserMiddleware("")

		w := httptest.NewRecorder()
		c, router := gin.CreateTestContext(w)

		reached := false
		router.GET("/", handler, func(_ *gin.Context) {
			reached = true
		})

		c.Request = httptest.NewRequest(
			http.MethodGet,
			"/",
			nil,
		)
		c.Request.Header.Set(
			"Accept",
			"text/html,application/xhtml+xml",
		)

		router.ServeHTTP(w, c.Request)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		if ct := w.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
			t.Errorf("expected Content-Type text/html; charset=utf-8, got %s", ct)
		}

		body := w.Body.String()
		if body == "" {
			t.Error("expected non-empty body")
		}

		if !strings.Contains(body, "Nhost MCP Service") {
			t.Error("expected default HTML to contain 'Nhost MCP Service'")
		}

		if reached {
			t.Error("expected next handler not to be called for browser request")
		}
	})

	t.Run("custom HTML from file", func(t *testing.T) {
		t.Parallel()

		htmlContent := "<html><body><h1>Custom Page</h1></body></html>"

		handler := browserMiddleware(htmlContent)

		w := httptest.NewRecorder()
		_, router := gin.CreateTestContext(w)
		router.GET("/", handler, func(c *gin.Context) {
			c.Status(http.StatusNoContent)
		})

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Accept", "text/html")

		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200, got %d", w.Code)
		}

		if w.Body.String() != htmlContent {
			t.Errorf(
				"expected custom HTML content, got %s",
				w.Body.String(),
			)
		}
	})

	t.Run("non-browser request passes through", func(t *testing.T) {
		t.Parallel()

		handler := browserMiddleware("")

		w := httptest.NewRecorder()
		_, router := gin.CreateTestContext(w)

		reached := false
		router.GET("/", handler, func(c *gin.Context) {
			reached = true

			c.Status(http.StatusNoContent)
		})

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Accept", "text/event-stream")

		router.ServeHTTP(w, req)

		if !reached {
			t.Error("expected next handler to be called for non-browser request")
		}

		if w.Code != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", w.Code)
		}
	})
}
