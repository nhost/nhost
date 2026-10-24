package cmd

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	oapimw "github.com/nhost/nhost/internal/lib/oapi/middleware"
	"github.com/nhost/nhost/services/auth/go/middleware/ratelimit"
)

func TestCORSExposesRetryAfterOnRateLimit(t *testing.T) {
	t.Parallel()

	cors, err := oapimw.CORS(getCORSOptions())
	if err != nil {
		t.Fatalf("creating CORS middleware: %v", err)
	}

	// Same order as the server: CORS first, then the rate limiter.
	router := gin.New()
	router.Use(cors, ratelimit.RateLimit(
		"",
		1, time.Minute, // global
		100, time.Minute, false, false, // email
		100, time.Minute, // sms
		100, time.Minute, // brute force
		100, time.Minute, // signups
		100, time.Minute, // oauth2 server
		ratelimit.NewInMemoryStore(),
	))
	router.GET("/healthz", func(c *gin.Context) { c.Status(http.StatusOK) })

	var resp *httptest.ResponseRecorder
	for range 2 {
		req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
		req.Header.Set("Origin", "https://app.example.com")

		resp = httptest.NewRecorder()
		router.ServeHTTP(resp, req)
	}

	if resp.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", resp.Code)
	}

	if resp.Header().Get("Retry-After") == "" {
		t.Fatal("429 response has no Retry-After header")
	}

	if got := resp.Header().Get("Access-Control-Allow-Origin"); got == "" {
		t.Fatal("429 response has no Access-Control-Allow-Origin header")
	}

	exposed := resp.Header().Get("Access-Control-Expose-Headers")
	if !strings.Contains(strings.ToLower(exposed), "retry-after") {
		t.Errorf("Access-Control-Expose-Headers = %q, want it to include Retry-After", exposed)
	}
}
