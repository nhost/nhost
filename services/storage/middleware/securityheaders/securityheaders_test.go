package securityheaders_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/middleware/securityheaders"
)

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(securityheaders.New())

	router.GET("/ok", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	router.GET("/svg", func(c *gin.Context) {
		c.Data(http.StatusOK, "image/svg+xml", []byte("<svg/>"))
	})

	router.GET("/error", func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "error")
	})

	return router
}

func TestSecurityHeaders(t *testing.T) {
	t.Parallel()

	wantHeaders := map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
		"X-Frame-Options":         "DENY",
	}

	cases := []struct {
		name string
		path string
	}{
		{name: "200 text response", path: "/ok"},
		{name: "200 svg response", path: "/svg"},
		{name: "500 error response", path: "/error"},
	}

	router := setupRouter()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			for header, want := range wantHeaders {
				got := w.Result().Header.Get(header)
				if diff := cmp.Diff(want, got); diff != "" {
					t.Errorf("%s mismatch (-want +got):\n%s", header, diff)
				}
			}
		})
	}
}
