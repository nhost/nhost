package middleware_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

func decodeLogLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()

	var records []map[string]any
	for line := range strings.SplitSeq(strings.TrimRight(buf.String(), "\n"), "\n") {
		if line == "" {
			continue
		}

		var rec map[string]any
		if err := json.Unmarshal([]byte(line), &rec); err != nil {
			t.Fatalf("unmarshal log line %q: %v", line, err)
		}

		records = append(records, rec)
	}

	return records
}

func newLoggerTestEngine(
	t *testing.T,
	middlewares []gin.HandlerFunc,
	handler gin.HandlerFunc,
) (*bytes.Buffer, *httptest.ResponseRecorder, *gin.Engine) {
	t.Helper()

	buf := &bytes.Buffer{}
	logger := slog.New(slog.NewJSONHandler(buf, nil))

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)

	for _, mw := range middlewares {
		engine.Use(mw)
	}

	engine.Use(middleware.Logger(logger))
	engine.GET("/", handler)

	return buf, rec, engine
}

func TestLoggerInjectsContextLogger(t *testing.T) {
	t.Parallel()

	var seen *slog.Logger

	buf, _, engine := newLoggerTestEngine(t, nil, func(c *gin.Context) {
		seen = middleware.LoggerFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	engine.ServeHTTP(httptest.NewRecorder(), req)

	if seen == nil || seen == slog.Default() {
		t.Fatal("handler did not observe injected request logger")
	}

	if got := decodeLogLines(t, buf); len(got) != 1 {
		t.Fatalf("log records = %d; want 1", len(got))
	}
}

func TestLoggerReadsTraceFromTracingMiddleware(t *testing.T) {
	t.Parallel()

	buf, rec, engine := newLoggerTestEngine(
		t,
		[]gin.HandlerFunc{middleware.Tracing()},
		func(c *gin.Context) { c.Status(http.StatusOK) },
	)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-B3-TraceId", "trace-123")
	req.Header.Set("X-B3-SpanId", "span-456")
	req.Header.Set("X-B3-ParentSpanId", "parent-789")
	engine.ServeHTTP(rec, req)

	records := decodeLogLines(t, buf)
	if len(records) != 1 {
		t.Fatalf("log records = %d; want 1", len(records))
	}

	trace, ok := records[0]["trace"].(map[string]any)
	if !ok {
		t.Fatalf("trace group missing from log record: %v", records[0])
	}

	for key, want := range map[string]string{
		"trace_id":       "trace-123",
		"span_id":        "span-456",
		"parent_span_id": "parent-789",
	} {
		if got := trace[key]; got != want {
			t.Errorf("trace.%s: got %v, want %s", key, got, want)
		}
	}

	if got := rec.Header().Get("X-B3-TraceId"); got != "trace-123" {
		t.Errorf("response trace header = %q; want trace-123", got)
	}
}

var errBoom = errors.New("boom")

func TestLoggerLogsErrors(t *testing.T) {
	t.Parallel()

	buf, _, engine := newLoggerTestEngine(t, nil, func(c *gin.Context) {
		_ = c.Error(errBoom)
		c.Status(http.StatusInternalServerError)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	engine.ServeHTTP(httptest.NewRecorder(), req)

	records := decodeLogLines(t, buf)
	if len(records) != 1 {
		t.Fatalf("log records = %d; want 1", len(records))
	}

	if got := records[0]["level"]; got != "ERROR" {
		t.Errorf("level = %v; want ERROR", got)
	}

	if got := records[0]["msg"]; got != "call completed with errors" {
		t.Errorf("msg = %v; want call completed with errors", got)
	}
}

func TestAddLoggerAttrs(t *testing.T) {
	t.Parallel()

	buf := &bytes.Buffer{}
	base := slog.New(slog.NewJSONHandler(buf, nil))

	ctx := middleware.LoggerToContext(t.Context(), base)
	ctx = middleware.AddLoggerAttrs(ctx, slog.String("role", "admin"))

	middleware.LoggerFromContext(ctx).InfoContext(ctx, "hello")

	records := decodeLogLines(t, buf)
	if len(records) != 1 {
		t.Fatalf("log records = %d; want 1", len(records))
	}

	if got := records[0]["role"]; got != "admin" {
		t.Errorf("role = %v; want admin", got)
	}
}

// TestAddLoggerAttrsVisibleInCompletionRecord is the property constellation's
// Session middleware relies on: a middleware that enriches the logger after
// Logger has run still has its attrs show up in Logger's completion record.
func TestAddLoggerAttrsVisibleInCompletionRecord(t *testing.T) {
	t.Parallel()

	buf := &bytes.Buffer{}
	logger := slog.New(slog.NewJSONHandler(buf, nil))

	gin.SetMode(gin.TestMode)

	_, engine := gin.CreateTestContext(httptest.NewRecorder())
	engine.Use(middleware.Logger(logger))
	engine.Use(func(c *gin.Context) {
		c.Request = c.Request.WithContext(
			middleware.AddLoggerAttrs(c.Request.Context(), slog.String("role", "admin")),
		)
		c.Next()
	})
	engine.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	engine.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	records := decodeLogLines(t, buf)
	if len(records) != 1 {
		t.Fatalf("log records = %d; want 1", len(records))
	}

	if got := records[0]["role"]; got != "admin" {
		t.Errorf("completion record role = %v; want admin", got)
	}
}
