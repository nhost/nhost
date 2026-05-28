package cmd

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/api"
	metadataapi "github.com/nhost/nhost/services/constellation/api/metadata"
)

// supportedServeRoutes is the canonical list of (method, path) pairs the
// constellation gin router serves natively. Anything not in this list is
// expected to fall through to the Hasura proxy fallback.
func supportedServeRoutes() []struct{ Method, Path string } {
	return []struct{ Method, Path string }{
		{http.MethodGet, "/healthz"},
		{http.MethodHead, "/healthz"},
		{http.MethodGet, "/v1/version"},
		{http.MethodPost, "/v1/metadata"},
		{http.MethodPost, "/v1/graphql"},
		{http.MethodGet, "/v1/graphql"},
		{http.MethodPost, "/v1"},
		{http.MethodGet, "/v1"},
	}
}

// buildServeRouter mirrors the route registration in getRouter so the routing
// behavior (which paths are handled natively vs. fall through to the Hasura
// proxy) can be tested without standing up a full controller / cli.Command.
//
// IMPORTANT: this is a HAND-MAINTAINED MIRROR of getRouter. Drift is not
// detected automatically. If you add a new native route in getRouter, mirror
// it here AND extend supportedServeRoutes. The self-consistency test
// (TestServeRouter_HarnessSelfConsistent) only checks the mirror against the
// table — it does not compare the mirror against getRouter.
func buildServeRouter(t *testing.T, proxy http.Handler) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.ContextWithFallback = true

	handled := func(c *gin.Context) { c.Status(http.StatusOK) }

	apiH := api.NewStrictHandler(&apiServer{version: "test"}, nil)
	api.RegisterHandlersWithOptions(router, apiH, api.GinServerOptions{
		BaseURL:      "",
		Middlewares:  nil,
		ErrorHandler: nil,
	})

	metaH := metadataapi.NewStrictHandler(
		&metadataServer{adminSecret: "x", proxy: nil, source: nil},
		nil,
	)
	metadataapi.RegisterHandlersWithOptions(router, metaH, metadataapi.GinServerOptions{
		BaseURL:      "",
		Middlewares:  []metadataapi.MiddlewareFunc{captureRawBody},
		ErrorHandler: nil,
	})

	router.POST("/v1/graphql", handled)
	router.GET("/v1/graphql", handled)
	router.POST("/v1", handled)
	router.GET("/v1", handled)

	if proxy != nil {
		router.NoRoute(func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})
	}

	return router
}

// Subtests are run sequentially on purpose: they share a single upstream
// httptest.Server and inspect a closure-captured proxyCalled flag. Making
// the subtests parallel would race on that flag and tear the server down
// underneath them via the deferred Close.
//
//nolint:paralleltest
func TestServeRouter_SupportedRoutesDoNotHitProxy(t *testing.T) {
	var proxyCalled bool

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, _ *http.Request) {
			proxyCalled = true

			w.WriteHeader(http.StatusOK)
		},
	))
	defer upstream.Close()

	proxy, err := newHasuraProxy(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("newHasuraProxy: %v", err)
	}

	router := buildServeRouter(t, proxy)

	front := httptest.NewServer(router)
	defer front.Close()

	for _, tc := range supportedServeRoutes() {
		t.Run(tc.Method+" "+tc.Path, func(t *testing.T) {
			proxyCalled = false

			req, err := http.NewRequestWithContext(
				context.Background(), tc.Method, front.URL+tc.Path,
				strings.NewReader(`{}`),
			)
			if err != nil {
				t.Fatalf("building request: %v", err)
			}

			req.Header.Set("Content-Type", "application/json")

			resp, err := front.Client().Do(req)
			if err != nil {
				t.Fatalf("request: %v", err)
			}

			_ = resp.Body.Close()

			if proxyCalled {
				t.Errorf("proxy was called for supported route %s %s", tc.Method, tc.Path)
			}
		})
	}
}

// Subtests are sequential for the same reason as
// TestServeRouter_SupportedRoutesDoNotHitProxy: they share one upstream
// server, and the deferred Close would otherwise race parallel subtests.
//
//nolint:paralleltest
func TestServeRouter_UnsupportedRoutesProxiedToHasura(t *testing.T) {
	type recorded struct {
		method, path string
		body         []byte
		header       string
	}

	hits := make(chan recorded, 16)

	upstream := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			body, _ := io.ReadAll(r.Body)
			hits <- recorded{
				method: r.Method,
				path:   r.URL.Path,
				body:   body,
				header: r.Header.Get("X-Hasura-Admin-Secret"),
			}

			w.WriteHeader(http.StatusOK)
		},
	))
	defer upstream.Close()

	proxy, err := newHasuraProxy(upstream.URL, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatalf("newHasuraProxy: %v", err)
	}

	router := buildServeRouter(t, proxy)

	front := httptest.NewServer(router)
	defer front.Close()

	unsupported := []struct {
		method, path, body string
	}{
		{http.MethodPost, "/v2/query", `{"type":"run_sql"}`},
		{http.MethodGet, "/apis/migrate", ""},
		{http.MethodPost, "/apis/migrate", `{"name":"init"}`},
		{http.MethodGet, "/apis/migrate/settings", ""},
		{http.MethodPost, "/apis/migrate/squash/create", `{}`},
		{http.MethodPost, "/apis/migrate/squash/delete", `{}`},
		{http.MethodPost, "/apis/metadata", `{"type":"export"}`},
		{http.MethodGet, "/totally/unknown", ""},
		{http.MethodDelete, "/v1/something-new", ""},
	}

	for _, tc := range unsupported {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req, err := http.NewRequestWithContext(
				context.Background(), tc.method, front.URL+tc.path,
				strings.NewReader(tc.body),
			)
			if err != nil {
				t.Fatalf("building request: %v", err)
			}

			req.Header.Set("X-Hasura-Admin-Secret", "the-secret")

			resp, err := front.Client().Do(req)
			if err != nil {
				t.Fatalf("request: %v", err)
			}

			_ = resp.Body.Close()

			select {
			case got := <-hits:
				if got.method != tc.method || got.path != tc.path {
					t.Errorf("upstream got %s %s; want %s %s",
						got.method, got.path, tc.method, tc.path)
				}

				if string(got.body) != tc.body {
					t.Errorf("upstream body = %q; want %q", got.body, tc.body)
				}

				if got.header != "the-secret" {
					t.Errorf("upstream X-Hasura-Admin-Secret = %q; want %q",
						got.header, "the-secret")
				}
			default:
				t.Errorf("upstream not called for %s %s", tc.method, tc.path)
			}
		})
	}
}

func TestServeRouter_NoProxyConfigured_UnsupportedReturns404(t *testing.T) {
	t.Parallel()

	router := buildServeRouter(t, nil)

	front := httptest.NewServer(router)
	t.Cleanup(front.Close)

	req, err := http.NewRequestWithContext(
		context.Background(), http.MethodGet, front.URL+"/totally/unknown", nil,
	)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}

	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d; want %d", resp.StatusCode, http.StatusNotFound)
	}
}

// TestServeRouter_HarnessSelfConsistent asserts that every (method, path)
// gin registers in buildServeRouter is present in supportedServeRoutes — so
// adding a route to the harness without updating the table fails loudly.
//
// This test does NOT compare against the production getRouter. Drift between
// getRouter and buildServeRouter (e.g. a new native route added to getRouter
// but not mirrored into the harness) is not detected here and must be caught
// by code review.
func TestServeRouter_HarnessSelfConsistent(t *testing.T) {
	t.Parallel()

	router := buildServeRouter(t, nil)

	declared := make(map[string]bool)
	for _, r := range supportedServeRoutes() {
		declared[r.Method+" "+r.Path] = true
	}

	for _, route := range router.Routes() {
		key := route.Method + " " + route.Path
		if !declared[key] {
			t.Errorf("router has route %s but supportedServeRoutes does not list it; "+
				"add it there so the routing tests cover it", key)
		}
	}
}
