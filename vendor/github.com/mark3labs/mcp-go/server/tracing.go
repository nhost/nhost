package server

import (
	"context"
	"net/http"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/tracing"
)

const (
	attrMethod          = "mcp.method"
	attrToolName        = "mcp.tool.name"
	attrSessionID       = "mcp.session.id"
	attrProtocolVersion = "mcp.protocol.version"
)

// WithTracer installs a tracer on the server. Spans:
//
//   - mcp.<method> (server) around every dispatched JSON-RPC method
//   - tool.<name> (internal) around every tool handler invocation
//
// Span attributes: mcp.method, mcp.tool.name (tools/call), mcp.session.id
// (when set), mcp.protocol.version (from the Mcp-Protocol-Version header).
//
// For end-to-end propagation install a Propagator with WithPropagator as
// well. Tool-handler panics surface in span status only when paired with
// WithRecovery. A nil tracer is treated as a no-op.
func WithTracer(tracer tracing.Tracer) ServerOption {
	if tracer == nil {
		tracer = tracing.NoopTracer()
	}
	return func(s *MCPServer) {
		s.tracer = tracer
		s.toolMiddlewareMu.Lock()
		s.toolHandlerMiddlewares = append(s.toolHandlerMiddlewares, toolTracingMiddleware(tracer))
		s.toolMiddlewareMu.Unlock()
	}
}

// WithPropagator installs a propagator that extracts trace context from
// inbound request headers. A nil propagator is treated as a no-op.
func WithPropagator(p tracing.Propagator) ServerOption {
	if p == nil {
		p = tracing.NoopPropagator()
	}
	return func(s *MCPServer) {
		s.propagator = p
	}
}

// WithMetaPropagator installs a propagator that extracts trace context from
// the MCP _meta property bag of inbound requests (per SEP-414). It covers
// all transports including stdio, where HTTP headers are unavailable.
// A nil propagator is treated as a no-op.
func WithMetaPropagator(p tracing.MetaPropagator) ServerOption {
	if p == nil {
		p = tracing.NoopMetaPropagator()
	}
	return func(s *MCPServer) {
		s.metaPropagator = p
	}
}

// extractMeta extracts trace context from the _meta bag into ctx.
// It is a no-op when no MetaPropagator is installed or meta is nil.
func (s *MCPServer) extractMeta(ctx context.Context, meta *mcp.Meta) context.Context {
	p := s.metaPropagator
	if p == nil {
		return ctx
	}
	return p.ExtractMeta(ctx, meta)
}

func (s *MCPServer) startMessageSpan(
	ctx context.Context,
	headers http.Header,
	method string,
) (context.Context, func(mcp.JSONRPCMessage)) {
	propagator := s.propagator
	if propagator == nil {
		propagator = tracing.NoopPropagator()
	}
	ctx = propagator.Extract(ctx, headers)

	attrs := []tracing.Attribute{tracing.String(attrMethod, method)}
	if session := ClientSessionFromContext(ctx); session != nil {
		if id := session.SessionID(); id != "" {
			attrs = append(attrs, tracing.String(attrSessionID, id))
		}
	}
	if v := headers.Get(HeaderKeyProtocolVersion); v != "" {
		attrs = append(attrs, tracing.String(attrProtocolVersion, v))
	}

	tracer := s.tracer
	if tracer == nil {
		tracer = tracing.NoopTracer()
	}
	ctx, span := tracer.Start(ctx, "mcp."+method, tracing.SpanKindServer, attrs...)

	return ctx, func(resp mcp.JSONRPCMessage) {
		if e, ok := resp.(mcp.JSONRPCError); ok {
			span.SetStatus(tracing.StatusError, e.Error.Message)
		}
		span.End()
	}
}

func toolTracingMiddleware(tracer tracing.Tracer) ToolHandlerMiddleware {
	return func(next ToolHandlerFunc) ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			name := request.Params.Name
			parent := tracing.SpanFromContext(ctx)
			parent.SetAttributes(tracing.String(attrToolName, name))

			ctx, span := tracer.Start(ctx, "tool."+name, tracing.SpanKindInternal,
				tracing.String(attrToolName, name),
			)
			defer span.End()

			result, err := next(ctx, request)
			switch {
			case err != nil:
				span.SetStatus(tracing.StatusError, err.Error())
				span.RecordError(err)
			case result != nil && result.IsError:
				const msg = "tool returned error result"
				span.SetStatus(tracing.StatusError, msg)
				parent.SetStatus(tracing.StatusError, msg)
			}
			return result, err
		}
	}
}
