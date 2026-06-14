package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// B3 spec mandates this exact casing (non-canonical for Go's http.Header,
// which would rewrite the trailing "Id" to "ID").
const (
	headerTraceID      = "X-B3-TraceId"
	headerSpanID       = "X-B3-SpanId"
	headerParentSpanID = "X-B3-ParentSpanId"
)

// Trace carries the Zipkin B3 identifiers extracted from, or generated for, a request.
type Trace struct {
	TraceID      string
	ParentSpanID string
	SpanID       string
}

type traceCtxKey struct{}

// TraceToContext stores trace in ctx so downstream handlers and middleware can retrieve it.
func TraceToContext(ctx context.Context, trace Trace) context.Context {
	return context.WithValue(ctx, traceCtxKey{}, trace)
}

// TraceFromContext returns the Trace stashed in ctx by Tracing, or the zero Trace.
func TraceFromContext(ctx context.Context) Trace { //nolint:contextcheck
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	trace, ok := ctx.Value(traceCtxKey{}).(Trace)
	if !ok {
		return Trace{
			TraceID:      "",
			ParentSpanID: "",
			SpanID:       "",
		}
	}

	return trace
}

// NewTrace creates a new trace with a new TraceID.
func NewTrace() Trace {
	return Trace{
		TraceID:      uuid.New().String(),
		ParentSpanID: "",
		SpanID:       "",
	}
}

// NewSpan creates a new span that shares the trace id and points to the current span as parent.
func (t Trace) NewSpan() Trace {
	return Trace{
		TraceID:      t.TraceID,
		ParentSpanID: t.SpanID,
		SpanID:       uuid.New().String(),
	}
}

// TraceFromHTTPHeaders extracts B3 tracing information from HTTP headers.
// If no trace id is present, a fresh one is generated.
func TraceFromHTTPHeaders(headers http.Header) Trace {
	traceID := headers.Get(
		headerTraceID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerTraceID
	if traceID == "" {
		traceID = uuid.New().String()
	}

	spanID := headers.Get(
		headerSpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerSpanID
	parentSpanID := headers.Get(
		headerParentSpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerParentSpanID

	return Trace{
		TraceID:      traceID,
		ParentSpanID: parentSpanID,
		SpanID:       spanID,
	}
}

// TraceToHTTPHeaders adds B3 tracing information to HTTP headers.
func TraceToHTTPHeaders(trace Trace, header http.Header) {
	header.Set(
		headerTraceID,
		trace.TraceID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerTraceID
	header.Set(
		headerParentSpanID,
		trace.ParentSpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerParentSpanID
	header.Set(
		headerSpanID,
		trace.SpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerSpanID
}

// Tracing returns a Gin middleware that propagates B3 tracing identifiers and
// stashes them in the request context for downstream consumers such as Logger.
func Tracing() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		trace := TraceFromHTTPHeaders(ctx.Request.Header)
		ctx.Request = ctx.Request.WithContext(TraceToContext(ctx.Request.Context(), trace))

		// Write the B3 response headers before running handlers: gin commits
		// the header map on the handler's first body write (WriteHeaderNow),
		// so headers set after ctx.Next() never reach the wire once a handler
		// has written a body.
		TraceToHTTPHeaders(trace, ctx.Writer.Header())

		ctx.Next()
	}
}
