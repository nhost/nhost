package server

import (
	"sync/atomic"

	"github.com/mark3labs/mcp-go/mcp"
)

// clientInfoStore provides thread-safe storage for a session's client info,
// client capabilities, and negotiated protocol version. It is intended to be
// embedded in concrete session types so each session gains GetClientInfo,
// SetClientInfo, GetClientCapabilities, SetClientCapabilities,
// ProtocolVersion, and SetProtocolVersion via method promotion without
// duplicating the atomic.Value boilerplate.
//
// Zero-value clientInfoStore is ready for use. All methods are safe for
// concurrent access.
type clientInfoStore struct {
	clientInfo         atomic.Value // stores mcp.Implementation
	clientCapabilities atomic.Value // stores mcp.ClientCapabilities
	protocolVersion    atomic.Value // stores string
}

// GetClientInfo returns the stored client info, or the zero value of
// mcp.Implementation if it has not been set.
func (s *clientInfoStore) GetClientInfo() mcp.Implementation {
	if value := s.clientInfo.Load(); value != nil {
		if clientInfo, ok := value.(mcp.Implementation); ok {
			return clientInfo
		}
	}
	return mcp.Implementation{}
}

// SetClientInfo replaces the stored client info.
func (s *clientInfoStore) SetClientInfo(clientInfo mcp.Implementation) {
	s.clientInfo.Store(clientInfo)
}

// GetClientCapabilities returns the stored client capabilities, or the
// zero value of mcp.ClientCapabilities if they have not been set.
func (s *clientInfoStore) GetClientCapabilities() mcp.ClientCapabilities {
	if value := s.clientCapabilities.Load(); value != nil {
		if clientCapabilities, ok := value.(mcp.ClientCapabilities); ok {
			return clientCapabilities
		}
	}
	return mcp.ClientCapabilities{}
}

// SetClientCapabilities replaces the stored client capabilities.
func (s *clientInfoStore) SetClientCapabilities(clientCapabilities mcp.ClientCapabilities) {
	s.clientCapabilities.Store(clientCapabilities)
}

// ProtocolVersion returns the protocol version in effect for this session, or
// "" when none has been recorded.
//
// For sessions established through the initialize handshake this is the
// negotiated version. For requests using protocol version 2026-07-28 or later,
// where there is no handshake, it is the version the request declared in its
// _meta.
func (s *clientInfoStore) ProtocolVersion() string {
	if value := s.protocolVersion.Load(); value != nil {
		if version, ok := value.(string); ok {
			return version
		}
	}
	return ""
}

// SetProtocolVersion records the protocol version in effect for this session.
func (s *clientInfoStore) SetProtocolVersion(version string) {
	s.protocolVersion.Store(version)
}
