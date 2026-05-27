// Package tracing provides a Gin middleware that propagates Zipkin B3
// distributed-tracing headers across an HTTP request/response pair and stashes
// the extracted trace identifiers in the request context for downstream
// consumers (e.g. the logger middleware).
//
// The middleware is intentionally decoupled from logging: callers that want
// trace IDs surfaced in log records compose [Tracing] with the logger
// middleware, but either can be used independently.
package tracing

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// B3 spec mandates this exact casing (non-canonical for Go's http.Header,
// which would rewrite the trailing "Id" to "ID").
// See https://github.com/openzipkin/b3-propagation.
const (
	headerTraceID      = "X-B3-TraceId"
	headerSpanID       = "X-B3-SpanId"
	headerParentSpanID = "X-B3-ParentSpanId"
)

// Trace carries the three Zipkin B3 identifiers extracted from (or generated
// for) a request.
type Trace struct {
	TraceID      string
	ParentSpanID string
	SpanID       string
}

type traceCtxKey struct{}

// ToContext stores t in ctx so downstream handlers and middleware can retrieve
// it via [FromContext].
func ToContext(ctx context.Context, t Trace) context.Context {
	return context.WithValue(ctx, traceCtxKey{}, t)
}

// FromContext returns the [Trace] stashed in ctx by [Tracing], or the zero
// [Trace] when none is present.
func FromContext(ctx context.Context) Trace { //nolint:contextcheck
	ginCtx, ok := ctx.(*gin.Context)
	if ok {
		ctx = ginCtx.Request.Context()
	}

	t, ok := ctx.Value(traceCtxKey{}).(Trace)
	if !ok {
		return Trace{
			TraceID:      "",
			ParentSpanID: "",
			SpanID:       "",
		}
	}

	return t
}

// FromHTTPHeaders extracts tracing information from HTTP headers.
// If no traceID is present, a new one is generated.
func FromHTTPHeaders(headers http.Header) Trace {
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

// ToHTTPHeaders writes t into header using the B3 propagation header names.
func ToHTTPHeaders(t Trace, header http.Header) {
	header.Set(
		headerTraceID,
		t.TraceID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerTraceID
	header.Set(
		headerParentSpanID,
		t.ParentSpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerParentSpanID
	header.Set(
		headerSpanID,
		t.SpanID,
	) //nolint:canonicalheader // B3 spec mandates non-canonical casing; see headerSpanID
}

// Tracing returns a Gin middleware that reads B3 propagation headers from the
// incoming request, stashes the resulting [Trace] in the request context, and
// echoes the trace identifiers back to the response.
//
// If the incoming request does not carry an X-B3-TraceId header, a fresh
// trace ID is generated so that downstream observability still has a stable
// correlation identifier.
func Tracing() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		t := FromHTTPHeaders(ctx.Request.Header)

		ctx.Request = ctx.Request.WithContext(ToContext(ctx.Request.Context(), t))

		ctx.Next()

		ToHTTPHeaders(t, ctx.Writer.Header())
	}
}
