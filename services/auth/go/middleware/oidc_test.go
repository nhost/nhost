package middleware_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/auth/go/middleware"
	"github.com/stretchr/testify/assert"
)

func TestOIDCRequests(t *testing.T) {
	t.Parallel()

	const bodyLimit = 32 << 10

	tests := []struct {
		name        string
		method      string
		path        string
		bodySize    int
		wantLimited bool
		wantHeaders bool
	}{
		{
			name: "signin below limit", method: http.MethodPost,
			path: "/v1/signin/oidc/x/idtoken", bodySize: bodyLimit - 1,
			wantLimited: false, wantHeaders: true,
		},
		{
			name: "signin at limit", method: http.MethodPost,
			path: "/v1/signin/oidc/x/idtoken", bodySize: bodyLimit,
			wantLimited: false, wantHeaders: true,
		},
		{
			name: "signin over limit", method: http.MethodPost,
			path: "/v1/signin/oidc/x/idtoken", bodySize: bodyLimit + 1,
			wantLimited: true, wantHeaders: true,
		},
		{
			name: "signup over limit", method: http.MethodPost,
			path: "/v1/signup/oidc/x/idtoken", bodySize: bodyLimit + 1,
			wantLimited: true, wantHeaders: true,
		},
		{
			name: "signup GET is not limited", method: http.MethodGet,
			path: "/v1/signup/oidc/x", bodySize: bodyLimit + 1,
			wantLimited: false, wantHeaders: true,
		},
		{
			name: "legacy provider GET", method: http.MethodGet,
			path: "/v1/signin/provider/google", bodySize: bodyLimit + 1,
			wantLimited: false, wantHeaders: false,
		},
		{
			name: "missing API prefix GET", method: http.MethodGet,
			path: "/signin/oidc/x", bodySize: bodyLimit + 1,
			wantLimited: false, wantHeaders: false,
		},
		{
			name: "non OIDC POST is not limited", method: http.MethodPost,
			path: "/v1/signin/provider/google", bodySize: bodyLimit + 1,
			wantLimited: false, wantHeaders: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body := strings.Repeat("x", tt.bodySize)

			var (
				gotBody []byte
				readErr error
				called  bool
			)

			router := gin.New()
			router.Use(middleware.OIDCRequests("/v1"))
			router.Handle(tt.method, tt.path, func(ctx *gin.Context) {
				called = true

				gotBody, readErr = io.ReadAll(ctx.Request.Body)
				if readErr != nil {
					ctx.Status(http.StatusRequestEntityTooLarge)
					return
				}

				ctx.Status(http.StatusOK)
			})

			response := httptest.NewRecorder()
			request := httptest.NewRequest(tt.method, tt.path, strings.NewReader(body))
			router.ServeHTTP(response, request)

			assert.True(t, called, "handler was not called")

			if tt.wantLimited {
				var maxBytesErr *http.MaxBytesError
				if assert.ErrorAs(t, readErr, &maxBytesErr) {
					assert.EqualValues(t, bodyLimit, maxBytesErr.Limit)
				}

				assert.Equal(t, http.StatusRequestEntityTooLarge, response.Code)
			} else {
				if readErr != nil {
					t.Fatalf("reading body: %v", readErr)
				}

				assert.Equal(t, body, string(gotBody), "handler must receive the complete body")
				assert.Equal(t, http.StatusOK, response.Code)
			}

			wantCacheControl, wantReferrerPolicy := "", ""
			if tt.wantHeaders {
				wantCacheControl, wantReferrerPolicy = "no-store", "no-referrer"
			}

			if got := response.Header().Get("Cache-Control"); got != wantCacheControl {
				t.Errorf("Cache-Control = %q, want %q", got, wantCacheControl)
			}

			if got := response.Header().Get("Referrer-Policy"); got != wantReferrerPolicy {
				t.Errorf("Referrer-Policy = %q, want %q", got, wantReferrerPolicy)
			}
		})
	}
}
