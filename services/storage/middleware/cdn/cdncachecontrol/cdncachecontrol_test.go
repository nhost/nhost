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

func TestCDNCacheControlNoAuthHeaders(t *testing.T) {
	t.Parallel()

	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	got := w.Header().Get("CDN-Cache-Control")
	want := "max-age=86400, public"

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
	}
}

func TestCDNCacheControlWithAuthorization(t *testing.T) {
	t.Parallel()

	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer token123")

	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	got := w.Header().Get("CDN-Cache-Control")
	want := "max-age=86400, public, no-cache"

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
	}
}

func TestCDNCacheControlWithHasuraAdminSecret(t *testing.T) {
	t.Parallel()

	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Hasura-Admin-Secret", "secret")

	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	got := w.Header().Get("CDN-Cache-Control")
	want := "max-age=86400, public, no-cache"

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
	}
}

func TestCDNCacheControlWithBothHeaders(t *testing.T) {
	t.Parallel()

	router := setupRouter()

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer token123")
	req.Header.Set("X-Hasura-Admin-Secret", "secret")

	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	got := w.Header().Get("CDN-Cache-Control")
	want := "max-age=86400, public, no-cache"

	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("CDN-Cache-Control mismatch (-want +got):\n%s", diff)
	}
}
