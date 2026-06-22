package requestcontext_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

// ginContextWith wraps ctx in a *gin.Context whose underlying request carries
// ctx, exercising the unwrap path in the accessors.
func ginContextWith(ctx context.Context, t *testing.T) *gin.Context {
	t.Helper()

	gin.SetMode(gin.TestMode)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)

	return c
}

func TestClientHeadersFromContext(t *testing.T) {
	t.Parallel()

	headers := http.Header{
		"X-Test":       []string{"value"},
		"Content-Type": []string{"application/json"},
	}
	ginHeaders := http.Header{"X-Gin": []string{"unwrap"}}

	tests := []struct {
		name       string
		ctxBuilder func(t *testing.T) context.Context
		want       http.Header
	}{
		{
			name: "round trip",
			ctxBuilder: func(t *testing.T) context.Context {
				t.Helper()
				return requestcontext.ClientHeadersToContext(t.Context(), headers)
			},
			want: headers,
		},
		{
			name: "missing returns nil",
			ctxBuilder: func(t *testing.T) context.Context {
				t.Helper()
				return t.Context()
			},
			want: nil,
		},
		{
			// Pass the gin context itself (which is a context.Context); the
			// function must unwrap to req.Context() to find the value.
			name: "gin context unwrap",
			ctxBuilder: func(t *testing.T) context.Context {
				t.Helper()

				return ginContextWith(
					requestcontext.ClientHeadersToContext(t.Context(), ginHeaders),
					t,
				)
			},
			want: ginHeaders,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := requestcontext.ClientHeadersFromContext(tt.ctxBuilder(t))

			if tt.want == nil {
				if got != nil {
					t.Errorf("expected nil headers, got %v", got)
				}

				return
			}

			if got == nil {
				t.Fatal("expected non-nil headers")
			}

			for key := range tt.want {
				if got.Get(key) != tt.want.Get(key) {
					t.Errorf("%s: got %q, want %q", key, got.Get(key), tt.want.Get(key))
				}
			}
		})
	}
}

// Compile-time guard that the helper signature we rely on actually accepts
// context.Context (rather than only *gin.Context or vice versa).
var _ func(context.Context) http.Header = requestcontext.ClientHeadersFromContext
