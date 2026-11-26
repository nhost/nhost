package transport

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

// LoggingOption configures a LoggingTransport.
type LoggingOption func(*loggingConfig)

type loggingConfig struct {
	level    slog.Level
	payloads bool
}

// WithLoggingLevel sets the slog level used for the log records emitted by
// the LoggingTransport. The default is slog.LevelDebug.
func WithLoggingLevel(level slog.Level) LoggingOption {
	return func(c *loggingConfig) {
		c.level = level
	}
}

// WithLoggingPayloads controls whether full JSON-RPC payloads (params,
// result and JSON-RPC error code/message) are included in the structured
// log records. When disabled, only message metadata (direction, method,
// id, duration and the bare "← response error" / "→ response error"
// marker for failed calls) is logged. The default is true.
func WithLoggingPayloads(enabled bool) LoggingOption {
	return func(c *loggingConfig) {
		c.payloads = enabled
	}
}

// LoggingTransport wraps a transport.Interface and logs every JSON-RPC
// message that flows through it using a slog.Logger. It is a transparent
// decorator: NewLogging returns a wrapper whose interface set mirrors the
// inner transport, so type assertions against BidirectionalInterface or
// HTTPConnection continue to behave as expected.
type LoggingTransport struct {
	inner  Interface
	logger *slog.Logger
	level  slog.Level
	logRaw bool

	notifyMu       sync.RWMutex
	onNotification func(notification mcp.JSONRPCNotification)
}

// NewLogging returns an Interface that logs all JSON-RPC traffic passing
// through inner using the provided logger. When logger is nil, slog.Default
// is used. If inner additionally implements BidirectionalInterface and/or
// HTTPConnection, the returned wrapper also implements those interfaces, so
// it can be used as a drop-in replacement.
//
// NewLogging installs its own notification handler on the inner transport
// so that incoming notifications can be logged. Because [Interface] does
// not expose a way to read the previously-registered handler, NewLogging
// must be applied before any handler is registered on the inner transport;
// otherwise the previously-registered handler will be displaced. Callers
// that need to receive notifications should register their handler on the
// returned wrapper, which will both log the notification and forward it.
func NewLogging(inner Interface, logger *slog.Logger, opts ...LoggingOption) Interface {
	base := newLoggingTransport(inner, logger, opts...)

	bidir, isBidir := inner.(BidirectionalInterface)
	httpConn, isHTTP := inner.(HTTPConnection)

	switch {
	case isBidir && isHTTP:
		return &loggingBidirHTTPTransport{
			loggingBidirTransport: loggingBidirTransport{LoggingTransport: base, bidir: bidir},
			http:                  httpConn,
		}
	case isBidir:
		return &loggingBidirTransport{LoggingTransport: base, bidir: bidir}
	case isHTTP:
		return &loggingHTTPTransport{LoggingTransport: base, http: httpConn}
	default:
		return base
	}
}

func newLoggingTransport(inner Interface, logger *slog.Logger, opts ...LoggingOption) *LoggingTransport {
	cfg := loggingConfig{level: slog.LevelDebug, payloads: true}
	for _, opt := range opts {
		opt(&cfg)
	}
	if logger == nil {
		logger = slog.Default()
	}
	lt := &LoggingTransport{
		inner:  inner,
		logger: logger,
		level:  cfg.level,
		logRaw: cfg.payloads,
	}
	// Pre-register a notification handler on the inner transport so that
	// notifications are still logged even when the user never registers one
	// on the wrapper.
	inner.SetNotificationHandler(lt.handleNotification)
	return lt
}

// Start delegates to the wrapped transport.
func (l *LoggingTransport) Start(ctx context.Context) error {
	return l.inner.Start(ctx)
}

// SendRequest forwards the request to the wrapped transport while logging
// both the outgoing request and the incoming response (or error).
func (l *LoggingTransport) SendRequest(ctx context.Context, request JSONRPCRequest) (*JSONRPCResponse, error) {
	attrs := []slog.Attr{
		slog.String("method", request.Method),
		slog.Any("id", request.ID),
	}
	if l.logRaw && request.Params != nil {
		attrs = append(attrs, slog.Any("params", request.Params))
	}
	l.log(ctx, "→ request", attrs...)

	start := time.Now()
	resp, err := l.inner.SendRequest(ctx, request)
	duration := time.Since(start)

	respAttrs := []slog.Attr{
		slog.Any("id", request.ID),
		slog.String("method", request.Method),
		slog.Duration("duration", duration),
	}
	if err != nil {
		respAttrs = append(respAttrs, slog.String("error", err.Error()))
		l.log(ctx, "← response error", respAttrs...)
		return nil, err
	}
	if resp != nil && resp.Error != nil {
		if l.logRaw {
			respAttrs = append(respAttrs,
				slog.Int("code", resp.Error.Code),
				slog.String("error", resp.Error.Message),
			)
		}
		l.log(ctx, "← response error", respAttrs...)
		return resp, nil
	}
	if l.logRaw && resp != nil && len(resp.Result) > 0 {
		respAttrs = append(respAttrs, slog.String("result", string(resp.Result)))
	}
	l.log(ctx, "← response", respAttrs...)
	return resp, nil
}

// SendNotification forwards a notification to the wrapped transport and logs
// the outgoing message.
func (l *LoggingTransport) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	attrs := []slog.Attr{slog.String("method", notification.Method)}
	if l.logRaw {
		if data, err := json.Marshal(notification.Params); err == nil && len(data) > 0 && string(data) != "null" {
			attrs = append(attrs, slog.String("params", string(data)))
		}
	}
	l.log(ctx, "→ notification", attrs...)

	if err := l.inner.SendNotification(ctx, notification); err != nil {
		l.log(ctx, "→ notification error",
			slog.String("method", notification.Method),
			slog.String("error", err.Error()),
		)
		return err
	}
	return nil
}

// SetNotificationHandler registers handler to receive notifications from the
// server. The wrapper logs every incoming notification before forwarding it
// to handler.
func (l *LoggingTransport) SetNotificationHandler(handler func(notification mcp.JSONRPCNotification)) {
	l.notifyMu.Lock()
	defer l.notifyMu.Unlock()
	l.onNotification = handler
}

// Close shuts down the wrapped transport.
func (l *LoggingTransport) Close() error {
	return l.inner.Close()
}

// GetSessionId returns the session id reported by the wrapped transport.
func (l *LoggingTransport) GetSessionId() string {
	return l.inner.GetSessionId()
}

// RequiresLegacyProtocol reports whether the wrapped transport rules out the
// stateless protocol core, e.g. Streamable HTTP with continuous listening.
func (l *LoggingTransport) RequiresLegacyProtocol() bool {
	legacy, ok := l.inner.(interface{ RequiresLegacyProtocol() bool })
	return ok && legacy.RequiresLegacyProtocol()
}

// SetConnectionLostHandler forwards the handler to the wrapped transport when
// it supports one (SSE); otherwise it is a no-op.
func (l *LoggingTransport) SetConnectionLostHandler(handler func(error)) {
	if setter, ok := l.inner.(interface{ SetConnectionLostHandler(func(error)) }); ok {
		setter.SetConnectionLostHandler(handler)
	}
}

func (l *LoggingTransport) handleNotification(notification mcp.JSONRPCNotification) {
	attrs := []slog.Attr{slog.String("method", notification.Method)}
	if l.logRaw {
		if data, err := json.Marshal(notification.Params); err == nil && len(data) > 0 && string(data) != "null" {
			attrs = append(attrs, slog.String("params", string(data)))
		}
	}
	l.log(context.Background(), "← notification", attrs...)

	l.notifyMu.RLock()
	h := l.onNotification
	l.notifyMu.RUnlock()
	if h != nil {
		h(notification)
	}
}

func (l *LoggingTransport) log(ctx context.Context, msg string, attrs ...slog.Attr) {
	if !l.logger.Enabled(ctx, l.level) {
		return
	}
	l.logger.LogAttrs(ctx, l.level, msg, attrs...)
}

// loggingBidirTransport adds BidirectionalInterface support when the inner
// transport implements it.
type loggingBidirTransport struct {
	*LoggingTransport
	bidir BidirectionalInterface
}

// SetRequestHandler registers a handler for incoming server-to-client
// requests. The wrapper logs each incoming request and the corresponding
// outgoing response before delegating to handler.
func (l *loggingBidirTransport) SetRequestHandler(handler RequestHandler) {
	if handler == nil {
		l.bidir.SetRequestHandler(nil)
		return
	}
	wrapped := func(ctx context.Context, req JSONRPCRequest) (*JSONRPCResponse, error) {
		attrs := []slog.Attr{
			slog.String("method", req.Method),
			slog.Any("id", req.ID),
		}
		if l.logRaw && req.Params != nil {
			attrs = append(attrs, slog.Any("params", req.Params))
		}
		l.log(ctx, "← request", attrs...)

		start := time.Now()
		resp, err := handler(ctx, req)
		duration := time.Since(start)

		respAttrs := []slog.Attr{
			slog.Any("id", req.ID),
			slog.String("method", req.Method),
			slog.Duration("duration", duration),
		}
		if err != nil {
			respAttrs = append(respAttrs, slog.String("error", err.Error()))
			l.log(ctx, "→ response error", respAttrs...)
			return nil, err
		}
		if resp != nil && resp.Error != nil {
			if l.logRaw {
				respAttrs = append(respAttrs,
					slog.Int("code", resp.Error.Code),
					slog.String("error", resp.Error.Message),
				)
			}
			l.log(ctx, "→ response error", respAttrs...)
			return resp, nil
		}
		if l.logRaw && resp != nil && len(resp.Result) > 0 {
			respAttrs = append(respAttrs, slog.String("result", string(resp.Result)))
		}
		l.log(ctx, "→ response", respAttrs...)
		return resp, nil
	}
	l.bidir.SetRequestHandler(wrapped)
}

// loggingHTTPTransport adds HTTPConnection support when the inner transport
// implements it.
type loggingHTTPTransport struct {
	*LoggingTransport
	http HTTPConnection
}

// SetProtocolVersion forwards the negotiated protocol version to the wrapped
// HTTP transport.
func (l *loggingHTTPTransport) SetProtocolVersion(version string) {
	l.http.SetProtocolVersion(version)
}

// loggingBidirHTTPTransport supports both BidirectionalInterface and
// HTTPConnection.
type loggingBidirHTTPTransport struct {
	loggingBidirTransport
	http HTTPConnection
}

// SetProtocolVersion forwards the negotiated protocol version to the wrapped
// HTTP transport.
func (l *loggingBidirHTTPTransport) SetProtocolVersion(version string) {
	l.http.SetProtocolVersion(version)
}
