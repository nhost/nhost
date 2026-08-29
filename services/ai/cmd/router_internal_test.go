package cmd

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
)

type route struct {
	method string
	path   string
}

func TestSetupRouterRoutes(t *testing.T) {
	t.Parallel()

	router := setupRouter(
		"/v1",
		"test-version",
		"test-secret",
		[]string{"*"},
		&webhookHandler{},
		&agents.Service{},
		slog.New(slog.DiscardHandler),
	)

	got := make([]route, 0, len(router.Routes()))
	for _, routeInfo := range router.Routes() {
		got = append(got, route{method: routeInfo.Method, path: routeInfo.Path})
	}

	slices.SortFunc(got, func(a, b route) int {
		if result := strings.Compare(a.path, b.path); result != 0 {
			return result
		}

		return strings.Compare(a.method, b.method)
	})

	want := []route{
		{method: http.MethodGet, path: "/healthz"},
		{method: http.MethodPost, path: "/v1/agents/sessions/:sessionID/approve-tools"},
		{method: http.MethodPost, path: "/v1/agents/sessions/:sessionID/messages"},
		{method: http.MethodGet, path: "/v1/version"},
		{method: http.MethodPost, path: "/v1/webhooks/auto-embeddings-configuration"},
		{method: http.MethodPost, path: "/v1/webhooks/generate-embeddings"},
	}

	if diff := cmp.Diff(want, got, cmp.AllowUnexported(route{})); diff != "" {
		t.Errorf("routes mismatch (-want +got):\n%s", diff)
	}
}

func TestSetupRouterResponses(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		method     string
		path       string
		body       string
		secret     string
		wantStatus int
		wantBody   string
	}{
		{
			name:       "health",
			method:     http.MethodGet,
			path:       "/healthz",
			body:       "",
			secret:     "",
			wantStatus: http.StatusOK,
			wantBody:   `{"healthz":"ok"}`,
		},
		{
			name:       "malformed auto embeddings webhook JSON",
			method:     http.MethodPost,
			path:       "/v1/webhooks/auto-embeddings-configuration",
			body:       `{"event":`,
			secret:     "test-secret",
			wantStatus: http.StatusBadRequest,
			wantBody:   `{"error":"unexpected EOF"}`,
		},
		{
			name:       "unknown auto embeddings operation",
			method:     http.MethodPost,
			path:       "/v1/webhooks/auto-embeddings-configuration",
			body:       `{"event":{"op":"UNKNOWN"}}`,
			secret:     "test-secret",
			wantStatus: http.StatusBadRequest,
			wantBody: `{"error":"unknown auto-embeddings event operation: ` +
				`\"UNKNOWN\""}`,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			router := setupRouter(
				"/v1",
				"test-version",
				"test-secret",
				[]string{"*"},
				&webhookHandler{},
				nil,
				slog.New(slog.DiscardHandler),
			)

			request := httptest.NewRequest(
				testCase.method,
				testCase.path,
				strings.NewReader(testCase.body),
			)
			if testCase.secret != "" {
				request.Header.Set("X-Graphite-Webhook-Secret", testCase.secret)
			}

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, testCase.wantStatus)
			}

			if got := response.Body.String(); got != testCase.wantBody {
				t.Errorf("body = %q, want %q", got, testCase.wantBody)
			}
		})
	}
}

func TestNeedsWebhookSecret(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		secret     string
		wantStatus int
	}{
		{name: "accepted", secret: "test-secret", wantStatus: http.StatusNoContent},
		{name: "rejected", secret: "wrong-secret", wantStatus: http.StatusUnauthorized},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			router.Use(needsWebhookSecret("test-secret"))
			router.POST("/webhook", func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			request.Header.Set("X-Graphite-Webhook-Secret", testCase.secret)

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != testCase.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, testCase.wantStatus)
			}
		})
	}
}
