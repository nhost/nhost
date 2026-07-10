package runservice_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	runservice "github.com/nhost/nhost/packages/nhost-go-run"
)

var errUnhealthy = errors.New("db down")

func TestHealthzHealthy(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)

	runservice.Healthz(nil).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("nil health: got status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestHealthzUnhealthy(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)

	health := func(context.Context) error { return errUnhealthy }
	runservice.Healthz(health).ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("failing health: got status %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
