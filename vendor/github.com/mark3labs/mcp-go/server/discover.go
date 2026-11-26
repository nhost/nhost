package server

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
)

// sessionProtocolVersionSetter is implemented by sessions that record the
// protocol version negotiated during initialize.
type sessionProtocolVersionSetter interface {
	// SetProtocolVersion records the negotiated protocol version.
	SetProtocolVersion(version string)
}

// ProtocolVersionSupporter is implemented by transports that cannot serve
// every protocol version this SDK knows about.
//
// The stateless protocol core introduced in 2026-07-28 cannot be served over a
// session-oriented transport, so a stateful Streamable HTTP server reports
// only the legacy versions. Clients learn the restriction from server/discover
// and can explicitly select a supported legacy version for the initialize
// handshake.
type ProtocolVersionSupporter interface {
	// SupportsProtocolVersion reports whether the transport can serve the
	// given protocol version.
	SupportsProtocolVersion(version string) bool
}

// supportedProtocolVersionsKey carries the transport's supported version list
// into request handling.
type supportedProtocolVersionsKey struct{}

// WithSupportedProtocolVersions returns a context advertising the protocol
// versions the current transport can serve. Transports set this before
// dispatching a request; server/discover reports it to the client.
func WithSupportedProtocolVersions(ctx context.Context, versions []string) context.Context {
	return context.WithValue(ctx, supportedProtocolVersionsKey{}, versions)
}

// SupportedProtocolVersionsFromContext returns the protocol versions the
// current transport can serve, defaulting to every version this SDK
// implements.
func SupportedProtocolVersionsFromContext(ctx context.Context) []string {
	if versions, ok := ctx.Value(supportedProtocolVersionsKey{}).([]string); ok && len(versions) > 0 {
		return versions
	}
	return mcp.ValidProtocolVersions
}

// FilterSupportedVersions returns the subset of [mcp.ValidProtocolVersions]
// that the transport can serve. A transport that does not implement
// [ProtocolVersionSupporter] is assumed to support every version.
func FilterSupportedVersions(transport any) []string {
	supporter, ok := transport.(ProtocolVersionSupporter)
	if !ok {
		return mcp.ValidProtocolVersions
	}
	out := make([]string, 0, len(mcp.ValidProtocolVersions))
	for _, version := range mcp.ValidProtocolVersions {
		if supporter.SupportsProtocolVersion(version) {
			out = append(out, version)
		}
	}
	return out
}

// handleDiscover serves the server/discover RPC introduced in protocol version
// 2026-07-28 (SEP-2575).
//
// It advertises the protocol versions the current transport can serve, the
// server's capabilities, its identity, and its instructions, letting a client
// negotiate without performing the legacy initialize handshake.
func (s *MCPServer) handleDiscover(
	ctx context.Context,
	_ any,
	_ mcp.DiscoverRequest,
) (*mcp.DiscoverResult, *requestError) {
	result := &mcp.DiscoverResult{
		SupportedVersions: SupportedProtocolVersionsFromContext(ctx),
		Capabilities:      s.serverCapabilitiesSnapshot(),
		Instructions:      s.instructions,
	}

	// Record the client's declared identity and capabilities on the session,
	// so that hooks and handlers observing the session see them even though no
	// handshake took place.
	if info := RequestProtocolInfoFromContext(ctx); info != nil && info.Modern {
		if session := ClientSessionFromContext(ctx); session != nil {
			applyRequestProtocolInfoToSession(session, info)
		}
	}

	return result, nil
}

// applyRequestProtocolInfoToSession copies the per-request client identity and
// capabilities onto the session, synthesizing the state that the initialize
// handshake used to establish. Handlers and hooks that inspect the session
// therefore behave identically in both protocol eras.
//
// The protocol version is deliberately not written to the session. It is a
// property of the request, not of the connection: a session is long-lived on
// stdio and in-process, and recording a modern version there would leak it
// into a subsequent request from a client using an earlier revision.
// RequestProtocolVersion reads the per-request value first for that reason.
func applyRequestProtocolInfoToSession(session ClientSession, info *RequestProtocolInfo) {
	if session == nil || info == nil || !info.Modern {
		return
	}
	if withInfo, ok := session.(SessionWithClientInfo); ok {
		if info.ClientInfo != nil {
			withInfo.SetClientInfo(*info.ClientInfo)
		}
		if info.ClientCapabilities != nil {
			withInfo.SetClientCapabilities(*info.ClientCapabilities)
		}
	}
	if !session.Initialized() {
		session.Initialize()
	}
}
