package cmd

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNewHasuraProxyRejectsInvalidURL(t *testing.T) {
	t.Parallel()

	logger := slog.New(slog.DiscardHandler)

	for _, raw := range []string{"", "not-a-url", "/relative/only"} {
		if _, err := newHasuraProxy(raw, logger); err == nil {
			t.Errorf("newHasuraProxy(%q) = nil error; want error", raw)
		}
	}
}

func TestNewHasuraProxyForwardsRequest(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)

	var (
		gotPath   string
		gotHeader string
	)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			gotPath = r.URL.Path
			gotHeader = r.Header.Get("X-Hasura-Admin-Secret")
			w.Header().Set("X-From-Upstream", "yes")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"result":"ok"}`))
		},
	))
	defer upstream.Close()

	logger := slog.New(slog.DiscardHandler)

	proxy, err := newHasuraProxy(upstream.URL, logger)
	if err != nil {
		t.Fatalf("newHasuraProxy error: %v", err)
	}

	router := gin.New()
	router.NoRoute(func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	})

	front := httptest.NewServer(router)
	defer front.Close()

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodPost, front.URL+"/v1/metadata", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	req.Header.Set("X-Hasura-Admin-Secret", "secret")

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d; want %d", resp.StatusCode, http.StatusOK)
	}

	if gotPath != "/v1/metadata" {
		t.Errorf("upstream path = %q; want %q", gotPath, "/v1/metadata")
	}

	if gotHeader != "secret" {
		t.Errorf("upstream X-Hasura-Admin-Secret = %q; want %q", gotHeader, "secret")
	}

	if resp.Header.Get("X-From-Upstream") != "yes" {
		t.Errorf("response missing upstream header X-From-Upstream")
	}

	if string(body) != `{"result":"ok"}` {
		t.Errorf("body = %q; want %q", string(body), `{"result":"ok"}`)
	}
}
