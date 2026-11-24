package server

import (
	"context"
	"errors"

	"github.com/mark3labs/mcp-go/mcp"
)

// RequestProtocolInfo describes the protocol era and per-request metadata of
// an incoming request.
//
// Protocol version 2026-07-28 removed the initialize handshake: every request
// carries its own protocol version, client identity, client capabilities, and
// desired log level in _meta (SEP-2575). This type normalizes that
// information so the rest of the server can treat both eras uniformly.
type RequestProtocolInfo struct {
	// Modern reports whether the request declared a protocol version of
	// 2026-07-28 or later in its _meta.
	Modern bool

	// ProtocolVersion is the version declared in _meta. It is empty for legacy
	// requests, whose version was fixed by the initialize handshake.
	ProtocolVersion string

	// ClientInfo identifies the client software, when it chose to say.
	ClientInfo *mcp.Implementation

	// ClientCapabilities are the capabilities the client declared for this
	// request. Servers MUST NOT infer capabilities from prior requests.
	ClientCapabilities *mcp.ClientCapabilities

	// LogLevel is the log level requested for this request. When empty, the
	// server MUST NOT emit notifications/message for the request.
	LogLevel mcp.LoggingLevel
}

type requestProtocolKey struct{}

// WithRequestProtocolInfo returns a context carrying the per-request protocol
// information.
func WithRequestProtocolInfo(ctx context.Context, info *RequestProtocolInfo) context.Context {
	return context.WithValue(ctx, requestProtocolKey{}, info)
}

// RequestProtocolInfoFromContext returns the per-request protocol information
// stored in ctx, or nil when the request did not carry any (that is, when it
// used a protocol version earlier than 2026-07-28).
func RequestProtocolInfoFromContext(ctx context.Context) *RequestProtocolInfo {
	info, _ := ctx.Value(requestProtocolKey{}).(*RequestProtocolInfo)
	return info
}

// IsModernRequest reports whether the request being handled uses the
// stateless protocol core introduced in 2026-07-28.
func IsModernRequest(ctx context.Context) bool {
	info := RequestProtocolInfoFromContext(ctx)
	return info != nil && info.Modern
}

// RequestProtocolVersion returns the protocol version in effect for the
// request being handled.
//
// For modern requests this is the version declared in _meta. For legacy
// requests it falls back to the version negotiated during initialize, when the
// session records one.
func RequestProtocolVersion(ctx context.Context) string {
	if info := RequestProtocolInfoFromContext(ctx); info != nil && info.ProtocolVersion != "" {
		return info.ProtocolVersion
	}
	if session := ClientSessionFromContext(ctx); session != nil {
		if versioned, ok := session.(SessionWithProtocolVersion); ok {
			return versioned.ProtocolVersion()
		}
	}
	return ""
}

// SessionWithProtocolVersion is implemented by sessions that remember the
// protocol version negotiated during initialize.
type SessionWithProtocolVersion interface {
	ClientSession
	// ProtocolVersion returns the negotiated protocol version, or "" when the
	// session has not been initialized.
	ProtocolVersion() string
}

// protocolInfoFromMeta reports what protocol era a JSON-RPC request belongs
// to from its params._meta, which HandleMessage decodes once with the rest of
// the envelope.
//
// A request belongs to the modern era only when it declares a protocol version
// of 2026-07-28 or later. Anything else - including a request with no _meta at
// all - is legacy, and is served through the initialize-handshake path.
//
// The returned error is non-nil only when a modern request is malformed: the
// required client capabilities are missing, or a well-known key holds a value
// of the wrong shape.
func protocolInfoFromMeta(meta *mcp.Meta) (*RequestProtocolInfo, error) {
	version := meta.ProtocolVersion()
	if !mcp.IsModernProtocol(version) {
		// Either no version at all, or an older one: legacy era.
		return &RequestProtocolInfo{ProtocolVersion: version}, nil
	}

	info := &RequestProtocolInfo{
		Modern:          true,
		ProtocolVersion: version,
		ClientInfo:      meta.ClientInfo(),
		LogLevel:        meta.LogLevel(),
	}

	// Client capabilities are required on every modern request. An empty
	// object is valid and means "no optional capabilities". A request without
	// them, or with a value that does not decode as capabilities, is malformed
	// and is rejected as invalid params (-32602).
	// MissingRequiredClientCapabilityError is for a request that needs a
	// capability the client did not declare.
	caps := meta.ClientCapabilities()
	if caps == nil {
		return nil, errors.New("missing or invalid _meta field " + mcp.MetaKeyClientCapabilities)
	}
	info.ClientCapabilities = caps

	return info, nil
}
