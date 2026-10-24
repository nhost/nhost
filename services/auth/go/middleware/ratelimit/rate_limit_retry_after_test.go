package ratelimit_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/auth/go/middleware/ratelimit"
)

func TestRateLimitRetryAfterHeader(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		path     string
		requests int
	}{
		{name: "global limit", path: "/healthz", requests: 3},
		{name: "brute force limit", path: "/signin/email-password", requests: 2},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			router.Use(ratelimit.RateLimit(
				"",
				2, time.Minute, // global
				100, time.Minute, false, false, // email
				100, time.Minute, // sms
				1, time.Minute, // brute force
				100, time.Minute, // signups
				100, time.Minute, // oauth2 server
				ratelimit.NewInMemoryStore(),
			))
			router.Any("/*path", func(c *gin.Context) { c.Status(http.StatusOK) })

			var resp *httptest.ResponseRecorder
			for i := range tc.requests {
				resp = httptest.NewRecorder()
				router.ServeHTTP(resp, httptest.NewRequest(http.MethodPost, tc.path, nil))

				if i < tc.requests-1 {
					if resp.Code != http.StatusOK {
						t.Fatalf("request %d: status = %d, want 200", i, resp.Code)
					}

					if h := resp.Header().Get("Retry-After"); h != "" {
						t.Fatalf("request %d: unexpected Retry-After %q on success", i, h)
					}
				}
			}

			if resp.Code != http.StatusTooManyRequests {
				t.Fatalf("status = %d, want 429", resp.Code)
			}

			seconds, err := strconv.Atoi(resp.Header().Get("Retry-After"))
			if err != nil {
				t.Fatalf(
					"Retry-After %q is not a number of seconds",
					resp.Header().Get("Retry-After"),
				)
			}

			if seconds < 1 || seconds > 60 {
				t.Errorf("Retry-After = %d, want between 1 and 60", seconds)
			}
		})
	}
}
