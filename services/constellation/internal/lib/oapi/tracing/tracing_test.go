package tracing_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

func TestTracingWritesIncomingHeadersToResponse(t *testing.T) {
	t.Parallel()

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)
	engine.Use(tracing.Tracing())
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
	engine.Use(tracing.Tracing())
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
	engine.Use(tracing.Tracing())

	var seen tracing.Trace
	engine.GET("/", func(c *gin.Context) {
		seen = tracing.FromContext(c.Request.Context())
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

func TestFromContextZeroWhenAbsent(t *testing.T) {
	t.Parallel()

	got := tracing.FromContext(context.Background())
	if got != (tracing.Trace{TraceID: "", SpanID: "", ParentSpanID: ""}) {
		t.Errorf("FromContext on empty context: got %+v, want zero", got)
	}
}

func TestToContextRoundTrip(t *testing.T) {
	t.Parallel()

	want := tracing.Trace{TraceID: "a", SpanID: "b", ParentSpanID: "c"}
	ctx := tracing.ToContext(context.Background(), want)

	if got := tracing.FromContext(ctx); got != want {
		t.Errorf("ToContext/FromContext round-trip: got %+v, want %+v", got, want)
	}
}
