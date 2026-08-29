package openai

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/ai/graph/middleware"
)

func newGinTestCtx(t *testing.T) context.Context {
	t.Helper()

	ginCtx, _ := gin.CreateTestContext(nil)
	ginCtx.Request = &http.Request{Header: http.Header{}}

	return middleware.GinToContext(t.Context(), ginCtx)
}

// TestWebhookToolWrapperBlocksPrivateIPs is the integration-level proof that
// webhook tool calls go through the SSRF-safe HTTP client. The dialer's
// per-IP allowlist and DNS-rebinding guard are unit-tested in
// internal/httpsafe; here we just verify the wiring.
func TestWebhookToolWrapperBlocksPrivateIPs(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			t.Error("server should not be reached; SSRF check must reject loopback")

			w.WriteHeader(http.StatusOK)
		}),
	)
	t.Cleanup(srv.Close)

	cases := []struct {
		name string
		url  string
	}{
		{name: "loopback test server", url: srv.URL},
		{name: "explicit loopback", url: "http://127.0.0.1:80"},
		{name: "AWS IMDS link-local", url: "http://169.254.169.254/latest/meta-data"},
		{name: "rfc1918 10.x", url: "http://10.0.0.1"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			fn := webhookToolWrapper(tc.url)

			got := fn(newGinTestCtx(t), `{"k":"v"}`, slog.Default())

			// toolRequest swallows transport errors and returns this
			// fixed string. SSRF rejection from the dialer surfaces here.
			if !strings.Contains(got, "error sending request") {
				t.Errorf("expected SSRF rejection (\"error sending request\"), got %q", got)
			}
		})
	}
}
