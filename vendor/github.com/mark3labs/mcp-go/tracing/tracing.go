// Package tracing defines the tracing interfaces used by the mcp-go client
// and server. Concrete implementations live in adapter modules; an
// OpenTelemetry adapter ships at github.com/mark3labs/mcp-go/otel.
package tracing

import (
	"context"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
)

// SpanKind identifies the role of a span in a trace.
type SpanKind int

const (
	SpanKindUnspecified SpanKind = iota
	SpanKindServer
	SpanKindClient
	SpanKindInternal
)

// StatusCode describes the final outcome status of a span.
type StatusCode int

const (
	StatusUnset StatusCode = iota
	StatusOK
	StatusError
)

// Attribute is a string key/value pair attached to a span.
type Attribute struct {
	Key, Value string
}

// String returns an Attribute with the given key and value.
func String(key, value string) Attribute {
	return Attribute{Key: key, Value: value}
}

// Tracer starts spans. Start returns a context carrying the new span and the
// span itself.
type Tracer interface {
	Start(ctx context.Context, name string, kind SpanKind, attrs ...Attribute) (context.Context, Span)
}

// Span is an in-flight tracing span. End must be called exactly once.
type Span interface {
	SetAttributes(attrs ...Attribute)
	RecordError(err error)
	SetStatus(code StatusCode, description string)
	End()
}

// Propagator carries tracing context across HTTP requests.
type Propagator interface {
	Inject(ctx context.Context, headers http.Header)
	Extract(ctx context.Context, headers http.Header) context.Context
}

// MetaPropagator carries tracing context through the MCP _meta property bag
// (per SEP-414). Unlike Propagator it operates on mcp.Meta rather than HTTP
// headers, so it works on every MCP transport including stdio.
//
// InjectMeta writes the active span context into meta.AdditionalFields.
// It allocates a new mcp.Meta when meta is nil and the propagator has
// something to write. It returns nil when meta would remain empty.
//
// ExtractMeta reads traceparent/tracestate/baggage from meta.AdditionalFields
// and returns a context that carries the extracted span context.
// It returns ctx unchanged when meta is nil.
type MetaPropagator interface {
	InjectMeta(ctx context.Context, meta *mcp.Meta) *mcp.Meta
	ExtractMeta(ctx context.Context, meta *mcp.Meta) context.Context
}

// NoopMetaPropagator returns a MetaPropagator whose methods are no-ops.
func NoopMetaPropagator() MetaPropagator { return noopMetaPropagator{} }

type spanContextKey struct{}

// ContextWithSpan returns ctx annotated with span so SpanFromContext can
// later retrieve it.
func ContextWithSpan(ctx context.Context, span Span) context.Context {
	return context.WithValue(ctx, spanContextKey{}, span)
}

// SpanFromContext returns the active Span, or a non-recording noop if none
// is present.
func SpanFromContext(ctx context.Context) Span {
	if s, ok := ctx.Value(spanContextKey{}).(Span); ok {
		return s
	}
	return noopSpan{}
}

// NoopTracer returns a Tracer that records nothing.
func NoopTracer() Tracer { return noopTracer{} }

// NoopPropagator returns a Propagator whose methods are no-ops.
func NoopPropagator() Propagator { return noopPropagator{} }

type noopTracer struct{}

func (noopTracer) Start(ctx context.Context, _ string, _ SpanKind, _ ...Attribute) (context.Context, Span) {
	return ctx, noopSpan{}
}

type noopSpan struct{}

func (noopSpan) SetAttributes(...Attribute)   {}
func (noopSpan) RecordError(error)            {}
func (noopSpan) SetStatus(StatusCode, string) {}
func (noopSpan) End()                         {}

type noopPropagator struct{}

func (noopPropagator) Inject(context.Context, http.Header)                        {}
func (noopPropagator) Extract(ctx context.Context, _ http.Header) context.Context { return ctx }

type noopMetaPropagator struct{}

func (noopMetaPropagator) InjectMeta(_ context.Context, meta *mcp.Meta) *mcp.Meta { return meta }
func (noopMetaPropagator) ExtractMeta(ctx context.Context, _ *mcp.Meta) context.Context {
	return ctx
}
