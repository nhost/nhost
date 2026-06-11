package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

func TestTracingWritesIncomingHeadersToResponse(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)
	engine.Use(middleware.Tracing())
	engine.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-B3-TraceId", "trace-123")
	req.Header.Set("X-B3-SpanId", "span-456")
	req.Header.Set("X-B3-ParentSpanId", "parent-789")
	engine.ServeHTTP(rec, req)

	for header, want := range map[string]string{
		"X-B3-TraceId":      "trace-123",
		"X-B3-SpanId":       "span-456",
		"X-B3-ParentSpanId": "parent-789",
	} {
		if got := rec.Header().Get(header); got != want {
			t.Errorf("response %s: got %q, want %q", header, got, want)
		}
	}
}

func TestTracingGeneratesTraceIDWhenAbsent(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)
	engine.Use(middleware.Tracing())
	engine.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	engine.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-B3-TraceId"); got == "" {
		t.Error("expected generated TraceId on response")
	}
}

func TestTracingStashesTraceInContext(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)
	engine.Use(middleware.Tracing())

	var seen middleware.Trace
	engine.GET("/", func(c *gin.Context) {
		seen = middleware.TraceFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-B3-TraceId", "trace-xyz")
	req.Header.Set("X-B3-SpanId", "span-xyz")
	req.Header.Set("X-B3-ParentSpanId", "parent-xyz")
	engine.ServeHTTP(rec, req)

	if seen.TraceID != "trace-xyz" {
		t.Errorf("TraceID: got %q, want trace-xyz", seen.TraceID)
	}

	if seen.SpanID != "span-xyz" {
		t.Errorf("SpanID: got %q, want span-xyz", seen.SpanID)
	}

	if seen.ParentSpanID != "parent-xyz" {
		t.Errorf("ParentSpanID: got %q, want parent-xyz", seen.ParentSpanID)
	}
}

func TestTraceContextRoundTrip(t *testing.T) {
	t.Parallel()

	want := middleware.Trace{TraceID: "a", SpanID: "b", ParentSpanID: "c"}
	ctx := middleware.TraceToContext(context.Background(), want)

	if got := middleware.TraceFromContext(ctx); got != want {
		t.Errorf("TraceToContext/TraceFromContext round-trip: got %+v, want %+v", got, want)
	}
}

func TestTraceFromHTTPHeadersGeneratesTraceID(t *testing.T) {
	t.Parallel()

	got := middleware.TraceFromHTTPHeaders(http.Header{})
	if got.TraceID == "" {
		t.Error("expected generated TraceID when none present")
	}

	other := middleware.TraceFromHTTPHeaders(http.Header{})
	if other.TraceID == got.TraceID {
		t.Errorf("expected unique generated TraceIDs, got %q twice", got.TraceID)
	}
}
