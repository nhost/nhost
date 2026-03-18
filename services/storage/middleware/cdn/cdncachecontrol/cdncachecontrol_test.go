package cdncachecontrol_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/middleware/cdn/cdncachecontrol"
)

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(cdncachecontrol.New())

	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	return router
}

func TestCDNCacheControl(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		headers          map[string]string
		wantCacheControl string
	}{
		{
			name:             "no auth headers",
			headers:          nil,
			wantCacheControl: "",
		},
		{
			name: "with Authorization header",
			headers: map[string]string{
				"Authorization": "Bearer token",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
		{
			name: "with X-Hasura-Admin-Secret header",
			headers: map[string]string{
				"X-Hasura-Admin-Secret": "secret",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
		{
			name: "with both auth headers",
			headers: map[string]string{
				"Authorization":         "Bearer token",
				"X-Hasura-Admin-Secret": "secret",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
	}

	router := setupRouter()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			got := w.Header().Get("CDN-Cache-Control")
			if diff := cmp.Diff(tc.wantCacheControl, got); diff != "" {
				t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
