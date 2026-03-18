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

	router.GET("/ok", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	router.GET("/not-found", func(c *gin.Context) {
		c.String(http.StatusNotFound, "not found")
	})

	router.GET("/error", func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "error")
	})

	return router
}

func TestCDNCacheControl(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		path             string
		headers          map[string]string
		wantCacheControl string
	}{
		{
			name:             "no auth headers",
			path:             "/ok",
			headers:          nil,
			wantCacheControl: "",
		},
		{
			name: "with Authorization header",
			path: "/ok",
			headers: map[string]string{
				"Authorization": "Bearer token",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
		{
			name: "with X-Hasura-Admin-Secret header",
			path: "/ok",
			headers: map[string]string{
				"X-Hasura-Admin-Secret": "secret",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
		{
			name: "with both auth headers",
			path: "/ok",
			headers: map[string]string{
				"Authorization":         "Bearer token",
				"X-Hasura-Admin-Secret": "secret",
			},
			wantCacheControl: "must-revalidate, no-cache",
		},
		{
			name:             "no header on 404",
			path:             "/not-found",
			headers:          nil,
			wantCacheControl: "",
		},
		{
			name: "no header on 404 with auth",
			path: "/not-found",
			headers: map[string]string{
				"Authorization": "Bearer token",
			},
			wantCacheControl: "",
		},
		{
			name: "no header on 500 with auth",
			path: "/error",
			headers: map[string]string{
				"Authorization": "Bearer token",
			},
			wantCacheControl: "",
		},
	}

	router := setupRouter()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			got := w.Result().Header.Get("CDN-Cache-Control")
			if diff := cmp.Diff(tc.wantCacheControl, got); diff != "" {
				t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
