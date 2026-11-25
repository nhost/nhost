package mcp

import "encoding/json"

// Well-known _meta keys defined by protocol version 2026-07-28 (SEP-2575).
//
// These keys carry the information that the initialize handshake used to
// establish once per session. They are namespaced with the reserved
// "io.modelcontextprotocol/" prefix.
const (
	// MetaKeyProtocolVersion identifies the MCP protocol version a request is
	// using. It is required on every request in protocol versions >= 2026-07-28
	// and, over HTTP, MUST match the MCP-Protocol-Version header.
	MetaKeyProtocolVersion = "io.modelcontextprotocol/protocolVersion"

	// MetaKeyClientInfo identifies the client software making a request.
	// Clients SHOULD include it on every request. The value is an
	// [Implementation]. It is self-reported and unverified: servers SHOULD NOT
	// use it for security decisions.
	MetaKeyClientInfo = "io.modelcontextprotocol/clientInfo"

	// MetaKeyClientCapabilities carries the client's capabilities for a single
	// request. It is required in protocol versions >= 2026-07-28. Servers MUST
	// NOT infer capabilities from prior requests. The value is a
	// [ClientCapabilities].
	MetaKeyClientCapabilities = "io.modelcontextprotocol/clientCapabilities"

	// MetaKeyServerInfo identifies the server software producing a result.
	// Servers SHOULD include it in every result's _meta. The value is an
	// [Implementation].
	MetaKeyServerInfo = "io.modelcontextprotocol/serverInfo"

	// MetaKeyLogLevel requests notifications/message at or above the given
	// level for a single request. When absent, servers MUST NOT emit log
	// notifications for that request. Replaces the logging/setLevel RPC.
	//
	// The Logging feature it belongs to is deprecated as of protocol version
	// 2026-07-28 (SEP-2577), and remains functional for at least twelve
	// months. Log to stderr or use OpenTelemetry instead.
	MetaKeyLogLevel = "io.modelcontextprotocol/logLevel"

	// MetaKeySubscriptionID identifies the subscriptions/listen stream a
	// notification was delivered on. The value is the JSON-RPC ID of the
	// subscriptions/listen request that opened the stream.
	MetaKeySubscriptionID = "io.modelcontextprotocol/subscriptionId"
)

// remarshal round-trips src through JSON into dst. It is used to convert
// generic map[string]any values decoded from the wire into concrete types.
func remarshal(src any, dst any) error {
	data, err := json.Marshal(src)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dst)
}

// decodeMetaValue extracts a typed value from a _meta map.
//
// Values may arrive either as a concrete Go value (when constructed in
// process, e.g. over the in-process transport) or as the generic
// map[string]any produced by encoding/json after wire transit. In the latter
// case the value is re-encoded and decoded into the target type.
func decodeMetaValue[T any](m map[string]any, key string) (T, bool) {
	var zero T
	raw, ok := m[key]
	if !ok || raw == nil {
		return zero, false
	}
	if typed, ok := raw.(T); ok {
		return typed, true
	}
	// Also accept a pointer when T is a value type and vice versa.
	var out T
	if err := remarshal(raw, &out); err != nil {
		return zero, false
	}
	return out, true
}

// GetMetaField returns the raw value stored under key in m's additional
// fields, or nil when absent.
func (m *Meta) GetMetaField(key string) any {
	if m == nil || m.AdditionalFields == nil {
		return nil
	}
	return m.AdditionalFields[key]
}

// SetMetaField stores value under key in m's additional fields.
func (m *Meta) SetMetaField(key string, value any) {
	if m.AdditionalFields == nil {
		m.AdditionalFields = make(map[string]any)
	}
	m.AdditionalFields[key] = value
}

// ProtocolVersion returns the protocol version declared in the _meta field, or
// "" when absent. See [MetaKeyProtocolVersion].
func (m *Meta) ProtocolVersion() string {
	if m == nil {
		return ""
	}
	version, _ := decodeMetaValue[string](m.AdditionalFields, MetaKeyProtocolVersion)
	return version
}

// SetProtocolVersion records the protocol version in the _meta field.
func (m *Meta) SetProtocolVersion(version string) {
	m.SetMetaField(MetaKeyProtocolVersion, version)
}

// ClientInfo returns the client implementation declared in the _meta field, or
// nil when absent or malformed. See [MetaKeyClientInfo].
func (m *Meta) ClientInfo() *Implementation {
	if m == nil {
		return nil
	}
	info, ok := decodeMetaValue[*Implementation](m.AdditionalFields, MetaKeyClientInfo)
	if !ok {
		return nil
	}
	return info
}

// SetClientInfo records the client implementation in the _meta field.
func (m *Meta) SetClientInfo(info Implementation) {
	m.SetMetaField(MetaKeyClientInfo, info)
}

// ClientCapabilities returns the per-request client capabilities declared in
// the _meta field, or nil when absent or malformed.
// See [MetaKeyClientCapabilities].
func (m *Meta) ClientCapabilities() *ClientCapabilities {
	if m == nil {
		return nil
	}
	caps, ok := decodeMetaValue[*ClientCapabilities](m.AdditionalFields, MetaKeyClientCapabilities)
	if !ok {
		return nil
	}
	return caps
}

// SetClientCapabilities records the per-request client capabilities in the
// _meta field.
func (m *Meta) SetClientCapabilities(caps ClientCapabilities) {
	m.SetMetaField(MetaKeyClientCapabilities, caps)
}

// ServerInfo returns the server implementation declared in the _meta field, or
// nil when absent or malformed. See [MetaKeyServerInfo].
func (m *Meta) ServerInfo() *Implementation {
	if m == nil {
		return nil
	}
	info, ok := decodeMetaValue[*Implementation](m.AdditionalFields, MetaKeyServerInfo)
	if !ok {
		return nil
	}
	return info
}

// SetServerInfo records the server implementation in the _meta field.
func (m *Meta) SetServerInfo(info Implementation) {
	m.SetMetaField(MetaKeyServerInfo, info)
}

// LogLevel returns the per-request log level declared in the _meta field, or
// "" when absent. See [MetaKeyLogLevel].
func (m *Meta) LogLevel() LoggingLevel {
	if m == nil {
		return ""
	}
	level, _ := decodeMetaValue[LoggingLevel](m.AdditionalFields, MetaKeyLogLevel)
	return level
}

// SetLogLevel records the per-request log level in the _meta field.
func (m *Meta) SetLogLevel(level LoggingLevel) {
	m.SetMetaField(MetaKeyLogLevel, level)
}

// SubscriptionID returns the subscription stream identifier declared in the
// _meta field, or nil when absent. See [MetaKeySubscriptionID].
func (m *Meta) SubscriptionID() any {
	if m == nil {
		return nil
	}
	return m.GetMetaField(MetaKeySubscriptionID)
}

// SetSubscriptionID records the subscription stream identifier in the _meta
// field.
func (m *Meta) SetSubscriptionID(id any) {
	m.SetMetaField(MetaKeySubscriptionID, id)
}
