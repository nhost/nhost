package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/nhost/nhost/internal/lib/oapi/middleware"
)

func loggingMiddleware(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			startTime := time.Now()
			trace := middleware.TraceFromHTTPHeaders(r.Header)

			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			reqLogger := logger.With(
				slog.Group(
					"trace",
					slog.String("trace_id", trace.TraceID),
					slog.String("span_id", trace.SpanID),
					slog.String(
						"parent_span_id",
						trace.ParentSpanID,
					),
				),
				slog.Group(
					"request",
					slog.String("client_ip", r.RemoteAddr),
					slog.String("method", r.Method),
					slog.String("url", r.RequestURI),
				),
			)

			ctx := middleware.LoggerToContext(r.Context(), reqLogger)
			r = r.WithContext(ctx)

			next.ServeHTTP(rw, r)

			middleware.TraceToHTTPHeaders(trace, w.Header())

			reqLogger.InfoContext(
				ctx,
				"call completed",
				slog.Group(
					"response",
					slog.Int("status_code", rw.statusCode),
					slog.Duration(
						"latency_time",
						time.Since(startTime),
					),
				),
			)
		})
	}
}

type responseWriter struct {
	http.ResponseWriter

	statusCode  int
	wroteHeader bool
}

func (rw *responseWriter) WriteHeader(code int) {
	if rw.wroteHeader {
		return
	}

	rw.wroteHeader = true
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Flush() {
	if f, ok := rw.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (rw *responseWriter) Unwrap() http.ResponseWriter {
	return rw.ResponseWriter
}
