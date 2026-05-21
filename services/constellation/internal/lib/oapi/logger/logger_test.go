package logger_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/logger"
	"github.com/nhost/nhost/services/constellation/internal/lib/oapi/tracing"
	"github.com/nhost/nhost/services/constellation/internal/requestcontext"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

// decodeLogLines parses a slog JSON handler buffer into structured records.
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

// newLoggerTestEngine wires the standard buffer + recorder + engine scaffold
// used by every Logger test: a JSON slog logger writing into a buffer, a
// gin engine with the supplied middlewares mounted, and a single GET /
// route running the supplied handler.
func newLoggerTestEngine(
	t *testing.T,
	middlewares []gin.HandlerFunc,
	handler gin.HandlerFunc,
) (*bytes.Buffer, *httptest.ResponseRecorder, *gin.Engine) {
	t.Helper()

	buf := &bytes.Buffer{}
	l := slog.New(slog.NewJSONHandler(buf, nil))

	rec := httptest.NewRecorder()
	_, engine := gin.CreateTestContext(rec)

	for _, mw := range middlewares {
		engine.Use(mw)
	}

	engine.Use(logger.Logger(l))
	engine.GET("/", handler)

	return buf, rec, engine
}

// assertContextLogger checks that the handler observed an injected,
// non-default slog.Logger via the request context.
func assertContextLogger(t *testing.T, seen *slog.Logger) {
	t.Helper()

	if seen == nil {
		t.Fatal("handler did not observe a logger in its request context")
	}

	if seen == slog.Default() {
		t.Fatal("handler observed slog.Default() rather than the injected logger")
	}
}

// assertResponseHeadersEmpty checks that the given response headers are
// absent from the recorder's headers.
func assertResponseHeadersEmpty(
	t *testing.T, rec *httptest.ResponseRecorder, headers []string,
) {
	t.Helper()

	for _, header := range headers {
		if got := rec.Header().Get(header); got != "" {
			t.Errorf("Logger must not write %s on its own; got %q", header, got)
		}
	}
}

// assertTraceGroup checks that the trace group on the given log record matches
// the expected keys/values.
func assertTraceGroup(t *testing.T, record map[string]any, want map[string]string) {
	t.Helper()

	trace, ok := record["trace"].(map[string]any)
	if !ok {
		t.Fatalf("expected trace group in log record: %v", record)
	}

	for key, expected := range want {
		if got := trace[key]; got != expected {
			t.Errorf("trace.%s: got %v, want %s", key, got, expected)
		}
	}
}

func TestLogger(t *testing.T) {
	t.Parallel()

	defaultHandler := func(c *gin.Context) { c.Status(http.StatusOK) }
	errorHandler := func(c *gin.Context) {
		_ = c.Error(errors.New("boom"))
		c.Status(http.StatusInternalServerError)
	}

	tests := []struct {
		name string
		// extraMiddlewares are inserted before the Logger middleware.
		extraMiddlewares []gin.HandlerFunc
		handler          gin.HandlerFunc
		requestHeaders   map[string]string
		// captureContextLogger, when true, makes the handler stash the
		// slog.Logger it sees in the request context for later inspection.
		captureContextLogger bool
		// wantResponseHeadersEmpty must all be absent from the response.
		wantResponseHeadersEmpty []string
		wantLogLevel             string
		wantLogMsg               string
		// wantTrace, when non-nil, is matched against the "trace" group on
		// the single emitted log record.
		wantTrace map[string]string
	}{
		{
			name:                     "injects_logger_into_request_context",
			extraMiddlewares:         nil,
			handler:                  defaultHandler,
			requestHeaders:           nil,
			captureContextLogger:     true,
			wantResponseHeadersEmpty: nil,
			wantLogLevel:             "INFO",
			wantLogMsg:               "call completed",
			wantTrace:                nil,
		},
		{
			name:             "does_not_write_trace_headers_on_its_own",
			extraMiddlewares: nil,
			handler:          defaultHandler,
			requestHeaders: map[string]string{
				"X-B3-TraceId":      "trace-123",
				"X-B3-SpanId":       "span-456",
				"X-B3-ParentSpanId": "parent-789",
			},
			captureContextLogger: false,
			wantResponseHeadersEmpty: []string{
				"X-B3-TraceId",
				"X-B3-SpanId",
				"X-B3-ParentSpanId",
			},
			wantLogLevel: "INFO",
			wantLogMsg:   "call completed",
			wantTrace:    nil,
		},
		{
			name:             "reads_trace_from_context",
			extraMiddlewares: []gin.HandlerFunc{tracing.Tracing()},
			handler:          defaultHandler,
			requestHeaders: map[string]string{
				"X-B3-TraceId":      "trace-123",
				"X-B3-SpanId":       "span-456",
				"X-B3-ParentSpanId": "parent-789",
			},
			captureContextLogger:     false,
			wantResponseHeadersEmpty: nil,
			wantLogLevel:             "INFO",
			wantLogMsg:               "call completed",
			wantTrace: map[string]string{
				"trace_id":       "trace-123",
				"span_id":        "span-456",
				"parent_span_id": "parent-789",
			},
		},
		{
			name:                     "logs_success",
			extraMiddlewares:         nil,
			handler:                  defaultHandler,
			requestHeaders:           nil,
			captureContextLogger:     false,
			wantResponseHeadersEmpty: nil,
			wantLogLevel:             "INFO",
			wantLogMsg:               "call completed",
			wantTrace:                nil,
		},
		{
			name:                     "logs_errors",
			extraMiddlewares:         nil,
			handler:                  errorHandler,
			requestHeaders:           nil,
			captureContextLogger:     false,
			wantResponseHeadersEmpty: nil,
			wantLogLevel:             "ERROR",
			wantLogMsg:               "call completed with errors",
			wantTrace:                nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var seen *slog.Logger

			handler := tt.handler
			if tt.captureContextLogger {
				userHandler := tt.handler
				handler = func(c *gin.Context) {
					seen = requestcontext.LoggerFromContext(c.Request.Context())
					userHandler(c)
				}
			}

			buf, rec, engine := newLoggerTestEngine(t, tt.extraMiddlewares, handler)

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			for k, v := range tt.requestHeaders {
				req.Header.Set(k, v)
			}

			engine.ServeHTTP(rec, req)

			if tt.captureContextLogger {
				assertContextLogger(t, seen)
			}

			assertResponseHeadersEmpty(t, rec, tt.wantResponseHeadersEmpty)

			records := decodeLogLines(t, buf)
			if len(records) != 1 {
				t.Fatalf("expected 1 log record, got %d: %s", len(records), buf.String())
			}

			r := records[0]
			if tt.wantLogLevel != "" && r["level"] != tt.wantLogLevel {
				t.Errorf("level: got %v, want %s", r["level"], tt.wantLogLevel)
			}

			if tt.wantLogMsg != "" && r["msg"] != tt.wantLogMsg {
				t.Errorf("msg: got %v, want %q", r["msg"], tt.wantLogMsg)
			}

			if tt.wantTrace != nil {
				assertTraceGroup(t, r, tt.wantTrace)
			}
		})
	}
}
