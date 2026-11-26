package server

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/mark3labs/mcp-go/mcp"
)

// Protocol version 2026-07-28 removed protocol-level sessions from the
// Streamable HTTP transport (SEP-2567, SEP-2575). A server serving that
// version:
//
//   - ignores the Mcp-Session-Id header, and never mints or echoes one;
//   - answers GET and DELETE on the MCP endpoint with 405 Method Not Allowed;
//   - ignores Last-Event-ID, because streams are no longer resumable;
//   - requires Mcp-Method and Mcp-Name on POST requests (SEP-2243).
//
// Older clients are unaffected: the era is decided per request, from the
// _meta the request carries, so both eras are served concurrently on the same
// endpoint.

// WithStreamableHTTPProtocolVersions restricts the protocol versions this
// transport advertises through server/discover.
//
// By default every version this SDK implements is advertised, including the
// stateless 2026-07-28 core. Restricting the list is useful for deployments
// that depend on protocol-level session state - per-session tools, for example
// - and therefore need clients to stay on a session-oriented revision.
//
// Passing no versions restores the default.
func WithStreamableHTTPProtocolVersions(versions ...string) StreamableHTTPOption {
	return func(s *StreamableHTTPServer) {
		if len(versions) == 0 {
			s.protocolVersions = nil
			return
		}
		s.protocolVersions = slices.Clone(versions)
	}
}

// SupportsProtocolVersion reports whether this transport can serve the given
// protocol version. It implements [ProtocolVersionSupporter].
func (s *StreamableHTTPServer) SupportsProtocolVersion(version string) bool {
	if !mcp.IsValidProtocolVersion(version) {
		return false
	}
	if len(s.protocolVersions) == 0 {
		return true
	}
	return slices.Contains(s.protocolVersions, version)
}

// supportedProtocolVersions returns the versions this transport advertises,
// newest first.
func (s *StreamableHTTPServer) supportedProtocolVersions() []string {
	return FilterSupportedVersions(s)
}

// requestEra describes which protocol era an incoming HTTP request belongs to.
type requestEra struct {
	// modern reports whether the request declared protocol version 2026-07-28
	// or later.
	modern bool
	// metaVersion is the version declared in the body's _meta, if any.
	metaVersion string
	// headerVersion is the value of the Mcp-Protocol-Version header, if any.
	headerVersion string
}

// detectRequestEra determines the protocol era of a POST request from the
// version declared in the body's _meta and in the Mcp-Protocol-Version header.
//
// A request is modern when either source names 2026-07-28 or later; naming it
// in only one of the two is a header mismatch, reported separately by
// [StreamableHTTPServer.validateModernRequest].
func detectRequestEra(header http.Header, meta *mcp.Meta) requestEra {
	era := requestEra{
		headerVersion: header.Get(mcp.HeaderProtocolVersion),
		metaVersion:   meta.ProtocolVersion(),
	}

	era.modern = mcp.IsModernProtocol(era.metaVersion) || mcp.IsModernProtocol(era.headerVersion)
	return era
}

// validateModernRequest applies the transport-level validation that protocol
// version 2026-07-28 requires of a POST request. It writes an error response
// and returns false when the request must be rejected.
func (s *StreamableHTTPServer) validateModernRequest(
	w HTTPResponseWriter,
	r *HTTPRequest,
	era requestEra,
	id any,
) bool {
	// Streams are no longer resumable, so Last-Event-ID has no meaning on a
	// POST and its presence signals a confused client.
	if r.header().Get(mcp.HeaderLastEventID) != "" {
		s.writeJSONRPCErrorStatus(w, id, mcp.HEADER_MISMATCH,
			"Last-Event-ID is not supported in protocol version "+mcp.ProtocolVersion20260728+
				": streams are not resumable, re-issue the request with a new ID",
			http.StatusBadRequest)
		return false
	}

	// Over HTTP, the protocol version must be stated in both the header and
	// the body, and the two must agree.
	if era.headerVersion == "" {
		s.writeJSONRPCErrorStatus(w, id, mcp.HEADER_MISMATCH,
			mcp.HeaderProtocolVersion+" header is required for requests carrying "+mcp.MetaKeyProtocolVersion,
			http.StatusBadRequest)
		return false
	}
	if era.metaVersion == "" {
		s.writeJSONRPCErrorStatus(w, id, mcp.INVALID_PARAMS,
			"missing or invalid _meta field "+mcp.MetaKeyProtocolVersion,
			http.StatusBadRequest)
		return false
	}
	if era.headerVersion != era.metaVersion {
		s.writeJSONRPCErrorStatus(w, id, mcp.HEADER_MISMATCH,
			mcp.HeaderProtocolVersion+" header "+era.headerVersion+" does not match request "+
				mcp.MetaKeyProtocolVersion+" "+era.metaVersion,
			http.StatusBadRequest)
		return false
	}

	// Reject versions this transport has been configured not to serve, telling
	// the client what it can use instead so it can negotiate down.
	if !s.SupportsProtocolVersion(era.metaVersion) {
		response := mcp.UnsupportedProtocolVersionError{
			Version:   era.metaVersion,
			Supported: s.supportedProtocolVersions(),
		}.JSONRPCError()
		response.ID = mcp.NewRequestId(id)
		s.writeJSONRPCMessage(w, response, http.StatusBadRequest)
		return false
	}

	return true
}

// httpStatusForJSONRPCError maps a JSON-RPC error code to the HTTP status
// protocol version 2026-07-28 prescribes for it.
func httpStatusForJSONRPCError(code int) int {
	switch code {
	case mcp.METHOD_NOT_FOUND:
		return http.StatusNotFound
	case mcp.HEADER_MISMATCH,
		mcp.MISSING_REQUIRED_CLIENT_CAPABILITY,
		mcp.UNSUPPORTED_PROTOCOL_VERSION,
		mcp.INVALID_REQUEST,
		mcp.INVALID_PARAMS,
		mcp.PARSE_ERROR:
		return http.StatusBadRequest
	default:
		return http.StatusOK
	}
}

// writeJSONRPCErrorStatus writes a JSON-RPC error response with an explicit
// HTTP status code.
func (s *StreamableHTTPServer) writeJSONRPCErrorStatus(
	w HTTPResponseWriter,
	id any,
	code int,
	message string,
	status int,
) {
	response := mcp.JSONRPCError{
		JSONRPC: mcp.JSONRPC_VERSION,
		ID:      mcp.NewRequestId(id),
		Error: mcp.JSONRPCErrorDetails{
			Code:    code,
			Message: message,
		},
	}
	s.writeJSONRPCMessage(w, response, status)
}

// writeJSONRPCMessage writes a JSON-RPC message with an explicit HTTP status
// code.
func (s *StreamableHTTPServer) writeJSONRPCMessage(w HTTPResponseWriter, message any, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(message); err != nil {
		s.logger.Error("Failed to write JSON-RPC message", "err", err)
	}
}

// rejectModernSessionMethod answers a GET or DELETE from a client using
// protocol version 2026-07-28 or later, where neither verb is part of the
// transport any more.
func (s *StreamableHTTPServer) rejectModernSessionMethod(w HTTPResponseWriter, verb string) {
	// RFC 9110 section 15.5.6 requires an Allow header on 405 responses.
	w.Header().Set("Allow", http.MethodPost)
	writeHTTPError(w,
		verb+" is not supported in protocol version "+mcp.ProtocolVersion20260728+
			": server-to-client messages use subscriptions/listen",
		http.StatusMethodNotAllowed)
}

// isModernHTTPRequest reports whether a request without a body - a GET or
// DELETE - came from a client using protocol version 2026-07-28 or later.
func isModernHTTPRequest(r *HTTPRequest) bool {
	return mcp.IsModernProtocol(r.header().Get(mcp.HeaderProtocolVersion))
}

// rejectUnsupportedProtocolVersion answers a request from a client using a
// protocol version before 2026-07-28 with 400 Bad Request when its
// Mcp-Protocol-Version header names a version this SDK does not implement, and
// reports whether it did. A missing header is accepted, as clients on
// 2025-03-26 do not send it.
func rejectUnsupportedProtocolVersion(w HTTPResponseWriter, version string) bool {
	if version == "" || mcp.IsValidProtocolVersion(version) {
		return false
	}
	writeHTTPErrorf(w, http.StatusBadRequest, "Unsupported protocol version: %s", version)
	return true
}
