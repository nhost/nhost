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

	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	got := w.Header().Get("CDN-Cache-Control")
	want := "must-revalidate, no-cache"

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
	}
}
