package server

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

const (
	logKeyMethod          = "mcp.method"
	logKeyToolName        = "mcp.tool.name"
	logKeySessionID       = "mcp.session.id"
	logKeyProtocolVersion = "mcp.protocol.version"
	logKeyDurationSeconds = "duration_s"
	logKeyOutcome         = "outcome"
	logKeyError           = "error"

	logMessageRequest = "mcp.request"
	logMessageTool    = "mcp.tool"

	logOutcomeOK          = "ok"
	logOutcomeError       = "error"
	logOutcomeErrorResult = "error_result"
)

// WithLogger installs a structured logger on the server. The server emits:
//
//   - One mcp.request line per dispatched JSON-RPC method, at level INFO,
//     with attributes mcp.method, mcp.session.id (when set),
//     mcp.protocol.version (from the Mcp-Protocol-Version header),
//     duration_s, outcome (ok|error), and error (when set).
//   - One mcp.tool line per tool handler invocation, at level INFO, with
//     attributes mcp.tool.name, duration_s, outcome
//     (ok|error|error_result), and error (when set).
//
// A nil logger is treated as a no-op (no lines are emitted).
//
// The provided slog.Handler is invoked with the request's context.Context,
// so handlers that read trace context (e.g. the OpenTelemetry slog bridge
// at go.opentelemetry.io/contrib/bridges/otelslog) automatically annotate
// records with the active span's TraceID/SpanID when a Tracer is also
// installed via WithTracer.
func WithLogger(logger *slog.Logger) ServerOption {
	return func(s *MCPServer) {
		s.requestLogger = logger
		if logger != nil {
			s.toolMiddlewareMu.Lock()
			s.toolHandlerMiddlewares = append(s.toolHandlerMiddlewares, toolLoggingMiddleware(logger))
			s.toolMiddlewareMu.Unlock()
		}
	}
}

// startMessageLog opens a per-request log scope and returns a finalizer
// that emits one line keyed by method outcome. When no logger is installed
// the finalizer is a no-op.
func (s *MCPServer) startMessageLog(
	ctx context.Context,
	headers http.Header,
	method string,
) func(mcp.JSONRPCMessage) {
	logger := s.requestLogger
	if logger == nil {
		return func(mcp.JSONRPCMessage) {}
	}
	start := time.Now()

	attrs := []slog.Attr{slog.String(logKeyMethod, method)}
	if session := ClientSessionFromContext(ctx); session != nil {
		if id := session.SessionID(); id != "" {
			attrs = append(attrs, slog.String(logKeySessionID, id))
		}
	}
	if v := headers.Get(HeaderKeyProtocolVersion); v != "" {
		attrs = append(attrs, slog.String(logKeyProtocolVersion, v))
	}

	return func(resp mcp.JSONRPCMessage) {
		final := append(slices.Clip(attrs),
			slog.Float64(logKeyDurationSeconds, time.Since(start).Seconds()),
		)
		if e, ok := resp.(mcp.JSONRPCError); ok {
			final = append(final,
				slog.String(logKeyOutcome, logOutcomeError),
				slog.String(logKeyError, e.Error.Message),
			)
		} else {
			final = append(final, slog.String(logKeyOutcome, logOutcomeOK))
		}
		logger.LogAttrs(ctx, slog.LevelInfo, logMessageRequest, final...)
	}
}

func toolLoggingMiddleware(logger *slog.Logger) ToolHandlerMiddleware {
	return func(next ToolHandlerFunc) ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			start := time.Now()
			result, err := next(ctx, request)
			attrs := []slog.Attr{
				slog.String(logKeyToolName, request.Params.Name),
				slog.Float64(logKeyDurationSeconds, time.Since(start).Seconds()),
			}
			switch {
			case err != nil:
				attrs = append(attrs,
					slog.String(logKeyOutcome, logOutcomeError),
					slog.String(logKeyError, err.Error()),
				)
			case result != nil && result.IsError:
				attrs = append(attrs, slog.String(logKeyOutcome, logOutcomeErrorResult))
			default:
				attrs = append(attrs, slog.String(logKeyOutcome, logOutcomeOK))
			}
			logger.LogAttrs(ctx, slog.LevelInfo, logMessageTool, attrs...)
			return result, err
		}
	}
}
