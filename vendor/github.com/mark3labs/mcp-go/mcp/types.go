// Package mcp defines the core types and interfaces for the Model Context Protocol (MCP).
// MCP is a protocol for communication between LLM-powered applications and their supporting services.
package mcp

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"strconv"

	"github.com/yosida95/uritemplate/v3"
)

type MCPMethod string

const (
	// MethodInitialize initiates connection and negotiates protocol capabilities.
	// https://modelcontextprotocol.io/specification/2024-11-05/basic/lifecycle/#initialization
	//
	// Removed in protocol version 2026-07-28 (SEP-2575), which carries the
	// protocol version, client identity, and client capabilities in each
	// request's _meta instead. Servers reject it on requests declaring that
	// version or later; use [MethodServerDiscover] there.
	MethodInitialize MCPMethod = "initialize"

	// MethodPing verifies connection liveness between client and server.
	// https://modelcontextprotocol.io/specification/2024-11-05/basic/utilities/ping/
	//
	// Removed in protocol version 2026-07-28 (SEP-2575), where liveness is a
	// transport concern. Servers reject it on requests declaring that version
	// or later.
	MethodPing MCPMethod = "ping"

	// MethodResourcesList lists all available server resources.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/resources/
	MethodResourcesList MCPMethod = "resources/list"

	// MethodResourcesTemplatesList provides URI templates for constructing resource URIs.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/resources/
	MethodResourcesTemplatesList MCPMethod = "resources/templates/list"

	// MethodResourcesRead retrieves content of a specific resource by URI.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/resources/
	MethodResourcesRead MCPMethod = "resources/read"

	// MethodResourcesSubscribe subscribes the client to updates for a resource.
	// https://modelcontextprotocol.io/specification/2025-11-25/server/resources
	//
	// Removed in protocol version 2026-07-28 (SEP-2575). Use the
	// ResourceSubscriptions field of a [MethodSubscriptionsListen] request
	// there.
	MethodResourcesSubscribe MCPMethod = "resources/subscribe"

	// MethodResourcesUnsubscribe cancels a previous resources/subscribe request.
	// https://modelcontextprotocol.io/specification/2025-11-25/server/resources
	//
	// Removed in protocol version 2026-07-28 (SEP-2575). Close the
	// [MethodSubscriptionsListen] stream instead.
	MethodResourcesUnsubscribe MCPMethod = "resources/unsubscribe"

	// MethodPromptsList lists all available prompt templates.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/prompts/
	MethodPromptsList MCPMethod = "prompts/list"

	// MethodPromptsGet retrieves a specific prompt template with filled parameters.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/prompts/
	MethodPromptsGet MCPMethod = "prompts/get"

	// MethodToolsList lists all available executable tools.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/tools/
	MethodToolsList MCPMethod = "tools/list"

	// MethodToolsCall invokes a specific tool with provided parameters.
	// https://modelcontextprotocol.io/specification/2024-11-05/server/tools/
	MethodToolsCall MCPMethod = "tools/call"

	// MethodSetLogLevel configures the minimum log level for client
	// https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/logging
	//
	// Removed in protocol version 2026-07-28 (SEP-2575). Set [MetaKeyLogLevel]
	// in each request's _meta instead.
	MethodSetLogLevel MCPMethod = "logging/setLevel"

	// MethodElicitationCreate requests additional information from the user during interactions.
	// https://modelcontextprotocol.io/docs/concepts/elicitation
	MethodElicitationCreate MCPMethod = "elicitation/create"

	// MethodNotificationElicitationComplete notifies when a URL mode elicitation completes.
	MethodNotificationElicitationComplete MCPMethod = "notifications/elicitation/complete"

	// MethodListRoots requests roots list from the client during interactions.
	// https://modelcontextprotocol.io/specification/2025-06-18/client/roots
	MethodListRoots MCPMethod = "roots/list"

	// MethodTasksGet retrieves the current status of a task.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
	MethodTasksGet MCPMethod = "tasks/get"

	// MethodTasksList lists all tasks for the current session.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
	MethodTasksList MCPMethod = "tasks/list"

	// MethodTasksResult retrieves the result of a completed task.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
	MethodTasksResult MCPMethod = "tasks/result"

	// MethodTasksCancel cancels an in-progress task.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
	MethodTasksCancel MCPMethod = "tasks/cancel"

	// MethodNotificationInitialized indicates that the client completed initialization.
	// https://modelcontextprotocol.io/specification/2024-11-05/basic/lifecycle/#initialization
	MethodNotificationInitialized MCPMethod = "notifications/initialized"

	// MethodNotificationCancelled cancels an in-flight request.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation
	MethodNotificationCancelled MCPMethod = "notifications/cancelled"

	// MethodNotificationProgress reports progress for a long-running request.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress
	MethodNotificationProgress MCPMethod = "notifications/progress"

	// MethodNotificationMessage is a server-pushed log message.
	// https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging
	MethodNotificationMessage MCPMethod = "notifications/message"

	// MethodNotificationResourcesListChanged notifies when the list of available resources changes.
	// https://modelcontextprotocol.io/specification/2025-03-26/server/resources#list-changed-notification
	MethodNotificationResourcesListChanged = "notifications/resources/list_changed"

	MethodNotificationResourceUpdated = "notifications/resources/updated"

	// MethodNotificationPromptsListChanged notifies when the list of available prompt templates changes.
	// https://modelcontextprotocol.io/specification/2025-03-26/server/prompts#list-changed-notification
	MethodNotificationPromptsListChanged = "notifications/prompts/list_changed"

	// MethodNotificationToolsListChanged notifies when the list of available tools changes.
	// https://modelcontextprotocol.io/specification/2025-06-18/server/tools#list-changed-notification
	MethodNotificationToolsListChanged = "notifications/tools/list_changed"

	// MethodNotificationRootsListChanged notifies when the list of available roots changes.
	// https://modelcontextprotocol.io/specification/2025-06-18/client/roots#root-list-changes
	MethodNotificationRootsListChanged = "notifications/roots/list_changed"

	// MethodNotificationTasksStatus notifies when a task's status changes.
	// https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
	MethodNotificationTasksStatus = "notifications/tasks/status"

	// MethodCompletionComplete returns completion suggestions for a given argument
	// https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion
	MethodCompletionComplete MCPMethod = "completion/complete"

	// MethodServerDiscover advertises the server's supported protocol versions,
	// capabilities, and identity. Servers implementing protocol version
	// 2026-07-28 or later MUST support it; it replaces the initialize handshake.
	// https://modelcontextprotocol.io/specification/2026-07-28/server/discover
	MethodServerDiscover MCPMethod = "server/discover"

	// MethodSubscriptionsListen opens a long-lived stream for server-to-client
	// notifications. It replaces the HTTP GET endpoint and the
	// resources/subscribe and resources/unsubscribe RPCs.
	// https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
	MethodSubscriptionsListen MCPMethod = "subscriptions/listen"

	// MethodNotificationSubscriptionsAcknowledged reports which subscriptions a
	// server established in response to a subscriptions/listen request.
	MethodNotificationSubscriptionsAcknowledged = "notifications/subscriptions/acknowledged"
)

type URITemplate struct {
	*uritemplate.Template
}

func (t *URITemplate) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.Raw())
}

func (t *URITemplate) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	template, err := uritemplate.New(raw)
	if err != nil {
		return err
	}
	t.Template = template
	return nil
}

/* JSON-RPC types */

// JSONRPCMessage represents either a JSONRPCRequest, JSONRPCNotification, JSONRPCResponse, or JSONRPCError
type JSONRPCMessage any

// Protocol version constants, negotiation helpers, and JSONRPC_VERSION live
// in version.go.

// ProgressToken is used to associate progress notifications with the original request.
type ProgressToken any

// Cursor is an opaque token used to represent a cursor for pagination.
type Cursor string

// Meta is metadata attached to a request's parameters. This can include fields
// formally defined by the protocol or other arbitrary data.
type Meta struct {
	// If specified, the caller is requesting out-of-band progress
	// notifications for this request (as represented by
	// notifications/progress). The value of this parameter is an
	// opaque token that will be attached to any subsequent
	// notifications. The receiver is not obligated to provide these
	// notifications.
	ProgressToken ProgressToken

	// AdditionalFields are any fields present in the Meta that are not
	// otherwise defined in the protocol.
	AdditionalFields map[string]any
}

func (m *Meta) MarshalJSON() ([]byte, error) {
	raw := make(map[string]any)
	if m.ProgressToken != nil {
		raw["progressToken"] = m.ProgressToken
	}
	maps.Copy(raw, m.AdditionalFields)

	return json.Marshal(raw)
}

func (m *Meta) UnmarshalJSON(data []byte) error {
	raw := make(map[string]any)
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	m.ProgressToken = raw["progressToken"]
	delete(raw, "progressToken")
	m.AdditionalFields = raw
	return nil
}

// NewMetaFromMap builds metadata without modifying or retaining the caller's map.
// Nested values are shared; only the top-level map is copied.
func NewMetaFromMap(m map[string]any) *Meta {
	fields := maps.Clone(m)
	progressToken := fields["progressToken"]
	delete(fields, "progressToken")

	return &Meta{
		ProgressToken:    progressToken,
		AdditionalFields: fields,
	}
}

type Request struct {
	Method string        `json:"method"`
	Params RequestParams `json:"params,omitzero"`
}

type RequestParams struct {
	Meta *Meta `json:"_meta,omitempty"`
}

type Params map[string]any

type Notification struct {
	Method string             `json:"method"`
	Params NotificationParams `json:"params,omitzero"`
}

type NotificationParams struct {
	// This parameter name is reserved by MCP to allow clients and
	// servers to attach additional metadata to their notifications.
	Meta map[string]any `json:"_meta,omitempty"`

	// Additional fields can be added to this map
	AdditionalFields map[string]any `json:"-"`
}

// MarshalJSON implements custom JSON marshaling
func (p NotificationParams) MarshalJSON() ([]byte, error) {
	// Create a map to hold all fields
	m := make(map[string]any)

	// Add Meta if it exists
	if p.Meta != nil {
		m["_meta"] = p.Meta
	}

	// Add all additional fields
	for k, v := range p.AdditionalFields {
		// Ensure we don't override the _meta field
		if k != "_meta" {
			m[k] = v
		}
	}

	return json.Marshal(m)
}

// UnmarshalJSON implements custom JSON unmarshaling
func (p *NotificationParams) UnmarshalJSON(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	if fields == nil {
		if p.Meta == nil {
			p.Meta = make(map[string]any)
		}
		if p.AdditionalFields == nil {
			p.AdditionalFields = make(map[string]any)
		}
		return nil
	}
	m := make(map[string]any, len(fields))
	for name, raw := range fields {
		if name == "requestId" {
			var id RequestId
			if err := json.Unmarshal(raw, &id); err == nil {
				m[name] = id.Value()
				if value, ok := m[name].(int64); ok && value >= -9007199254740991 && value <= 9007199254740991 {
					m[name] = float64(value)
				}
				continue
			}
		}
		var value any
		if err := json.Unmarshal(raw, &value); err != nil {
			return err
		}
		m[name] = value
	}

	meta := make(map[string]any)
	if v, ok := m["_meta"].(map[string]any); ok {
		meta = v
	}
	delete(m, "_meta")
	p.Meta = meta
	p.AdditionalFields = m

	return nil
}

type Result struct {
	// This result property is reserved by the protocol to allow clients and
	// servers to attach additional metadata to their responses.
	Meta *Meta `json:"_meta,omitempty"`

	// ResultType indicates how the client should interpret this result.
	//
	// Servers implementing protocol version 2026-07-28 or later MUST populate
	// it. It is omitted when responding to a request that used an earlier
	// protocol version; clients MUST treat an absent value as
	// [ResultTypeComplete].
	ResultType ResultType `json:"resultType,omitempty"`
}

// RequestId is a uniquely identifying ID for a request in JSON-RPC.
// It can be any JSON-serializable value, typically a number or string.
type RequestId struct {
	value any
}

// NewRequestId creates a new RequestId with the given value
func NewRequestId(value any) RequestId {
	return RequestId{value: value}
}

// Value returns the underlying value of the RequestId.
// Decoded integers use int64 when representable, otherwise json.Number to
// preserve the exact value. Strings and fractional numbers retain their types.
func (r RequestId) Value() any {
	return r.value
}

// String returns a string representation of the RequestId
func (r RequestId) String() string {
	switch v := r.value.(type) {
	case string:
		return "string:" + v
	case int64:
		return "int64:" + strconv.FormatInt(v, 10)
	case float64:
		if encoded, err := json.Marshal(v); err == nil {
			number := json.Number(encoded)
			if _, integer := integerRequestNumber(number); integer {
				return requestNumberKey(number)
			}
		}
		return "float64:" + strconv.FormatFloat(v, 'f', -1, 64)
	case json.Number:
		return requestNumberKey(v)
	case nil:
		return "<nil>"
	default:
		if encoded, err := json.Marshal(v); err == nil {
			var decoded RequestId
			if err := json.Unmarshal(encoded, &decoded); err == nil {
				return decoded.String()
			}
		}
		return "unknown:" + fmt.Sprintf("%v", v)
	}
}

// IsNil returns true if the RequestId is nil
func (r RequestId) IsNil() bool {
	return r.value == nil
}

func (r RequestId) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.value)
}

func (r *RequestId) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		r.value = nil
		return nil
	}

	// Try unmarshaling as string first
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		r.value = s
		return nil
	}

	var number json.Number
	if err := json.Unmarshal(data, &number); err == nil {
		if value, integer := integerRequestNumber(number); integer {
			r.value = value
			return nil
		}
	}

	// JSON numbers are unmarshaled as float64 in Go
	var f float64
	if err := json.Unmarshal(data, &f); err == nil {
		if f == float64(int64(f)) {
			r.value = int64(f)
		} else {
			r.value = f
		}
		return nil
	}

	return fmt.Errorf("invalid request id: %s", string(data))
}

// JSONRPCRequest represents a request that expects a response.
type JSONRPCRequest struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      RequestId `json:"id"`
	Params  any       `json:"params,omitempty"`
	Request
}

// JSONRPCNotification represents a notification which does not expect a response.
type JSONRPCNotification struct {
	JSONRPC string `json:"jsonrpc"`
	Notification
}

// JSONRPCResponse represents a successful (non-error) response to a request.
type JSONRPCResponse struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      RequestId `json:"id"`
	Result  any       `json:"result"`
}

// JSONRPCError represents a non-successful (error) response to a request.
type JSONRPCError struct {
	JSONRPC string              `json:"jsonrpc"`
	ID      RequestId           `json:"id"`
	Error   JSONRPCErrorDetails `json:"error"`
}

// JSONRPCErrorDetails represents a JSON-RPC error for Go error handling.
// This is separate from the JSONRPCError type which represents the full JSON-RPC error response structure.
type JSONRPCErrorDetails struct {
	// The error type that occurred.
	Code int `json:"code"`
	// A short description of the error. The message SHOULD be limited
	// to a concise single sentence.
	Message string `json:"message"`
	// Additional information about the error. The value of this member
	// is defined by the sender (e.g. detailed error information, nested errors etc.).
	Data any `json:"data,omitempty"`
}

// UnmarshalJSON handles both the standard JSON-RPC error object
// ({"code": -32600, "message": "..."}) and non-compliant servers that
// return the error as a plain string (e.g. "cursor_invalid").
func (e *JSONRPCErrorDetails) UnmarshalJSON(data []byte) error {
	// Try the spec-compliant object shape first.
	type plain JSONRPCErrorDetails
	if err := json.Unmarshal(data, (*plain)(e)); err == nil {
		return nil
	}
	// Some servers (e.g. Slack MCP) return a bare string.
	var msg string
	if err := json.Unmarshal(data, &msg); err != nil {
		return fmt.Errorf("error field is neither an object nor a string: %w", err)
	}
	e.Code = INTERNAL_ERROR
	e.Message = msg
	return nil
}

// Standard JSON-RPC error codes
const (
	// PARSE_ERROR indicates invalid JSON was received by the server.
	PARSE_ERROR = -32700

	// INVALID_REQUEST indicates the JSON sent is not a valid Request object.
	INVALID_REQUEST = -32600

	// METHOD_NOT_FOUND indicates the method does not exist/is not available.
	METHOD_NOT_FOUND = -32601

	// INVALID_PARAMS indicates invalid method parameter(s).
	INVALID_PARAMS = -32602

	// INTERNAL_ERROR indicates internal JSON-RPC error.
	INTERNAL_ERROR = -32603

	// REQUEST_INTERRUPTED indicates a request was cancelled or timed out.
	REQUEST_INTERRUPTED = -32800
)

// MCP error codes
//
// Protocol version 2026-07-28 partitions the JSON-RPC server-error range:
// -32000 to -32019 remains implementation-defined (existing SDK usage is
// grandfathered) and -32020 to -32099 is reserved for the MCP specification.
const (
	// RESOURCE_NOT_FOUND indicates that the requested resource was not found.
	//
	// Protocol version 2026-07-28 aligns this condition with JSON-RPC by using
	// [INVALID_PARAMS] instead. This code is still emitted to, and accepted
	// from, peers using an earlier version.
	RESOURCE_NOT_FOUND = -32002

	// URL_ELICITATION_REQUIRED is the error code for when URL elicitation is required.
	URL_ELICITATION_REQUIRED = -32042

	// HEADER_MISMATCH indicates that a standard MCP HTTP header is missing,
	// malformed, or does not match the corresponding value in the request body
	// (SEP-2243).
	HEADER_MISMATCH = -32020

	// MISSING_REQUIRED_CLIENT_CAPABILITY indicates the client did not declare a
	// capability the server requires to serve the request (SEP-2575).
	MISSING_REQUIRED_CLIENT_CAPABILITY = -32021

	// UNSUPPORTED_PROTOCOL_VERSION indicates the server does not implement the
	// protocol version the request declared (SEP-2575). The error data carries
	// an [UnsupportedProtocolVersionData].
	UNSUPPORTED_PROTOCOL_VERSION = -32022
)

/* Empty result */

// EmptyResult represents a response that indicates success but carries no data.
type EmptyResult Result

/* Cancellation */

// CancelledNotification can be sent by either side to indicate that it is
// cancelling a previously-issued request.
//
// The request SHOULD still be in-flight, but due to communication latency, it
// is always possible that this notification MAY arrive after the request has
// already finished.
//
// This notification indicates that the result will be unused, so any
// associated processing SHOULD cease.
//
// A client MUST NOT attempt to cancel its `initialize` request.
type CancelledNotification struct {
	Notification
	Params CancelledNotificationParams `json:"params"`
}

type CancelledNotificationParams struct {
	// The ID of the request to cancel.
	//
	// This MUST correspond to the ID of a request previously issued
	// in the same direction.
	RequestId RequestId `json:"requestId"`

	// An optional string describing the reason for the cancellation. This MAY
	// be logged or presented to the user.
	Reason string `json:"reason,omitempty"`
}

/* Initialization */

// InitializeRequest is sent from the client to the server when it first
// connects, asking it to begin initialization.
type InitializeRequest struct {
	Request
	Params InitializeParams `json:"params"`
	Header http.Header      `json:"-"`
}

type InitializeParams struct {
	// The latest version of the Model Context Protocol that the client supports.
	// The client MAY decide to support older versions as well.
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ClientCapabilities `json:"capabilities"`
	ClientInfo      Implementation     `json:"clientInfo"`
}

// InitializeResult is sent after receiving an initialize request from the
// client.
type InitializeResult struct {
	Result
	// The version of the Model Context Protocol that the server wants to use.
	// This may not match the version that the client requested. If the client cannot
	// support this version, it MUST disconnect.
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      Implementation     `json:"serverInfo"`
	// Instructions describing how to use the server and its features.
	//
	// This can be used by clients to improve the LLM's understanding of
	// available tools, resources, etc. It can be thought of like a "hint" to the model.
	// For example, this information MAY be added to the system prompt.
	Instructions string `json:"instructions,omitempty"`
}

// InitializedNotification is sent from the client to the server after
// initialization has finished.
type InitializedNotification struct {
	Notification
}

// ClientCapabilities represents capabilities a client may support. Known
// capabilities are defined here, in this schema, but this is not a closed set: any
// client can define its own, additional capabilities.
type ClientCapabilities struct {
	// Optional, present if the client is advertising extension support.
	Extensions map[string]any `json:"extensions,omitempty"`
	// Experimental, non-standard capabilities that the client supports.
	Experimental map[string]any `json:"experimental,omitempty"`
	// Present if the client supports listing roots.
	Roots *struct {
		// Whether the client supports notifications for changes to the roots list.
		ListChanged bool `json:"listChanged,omitempty"`
	} `json:"roots,omitempty"`
	// Present if the client supports sampling from an LLM.
	Sampling *SamplingCapability `json:"sampling,omitempty"`
	// Present if the client supports elicitation requests from the server.
	Elicitation *ElicitationCapability `json:"elicitation,omitempty"`
	// Present if the client supports task-based execution.
	Tasks *TasksCapability `json:"tasks,omitempty"`
}

// ServerCapabilities represents capabilities that a server may support. Known
// capabilities are defined here, in this schema, but this is not a closed set: any
// server can define its own, additional capabilities.
type ServerCapabilities struct {
	// Optional, present if the server is advertising extension support.
	Extensions map[string]any `json:"extensions,omitempty"`
	// Experimental, non-standard capabilities that the server supports.
	Experimental map[string]any `json:"experimental,omitempty"`
	// Present if the server supports sending log messages to the client.
	Logging *struct{} `json:"logging,omitempty"`
	// Present if the server offers any prompt templates.
	Prompts *struct {
		// Whether this server supports notifications for changes to the prompt list.
		ListChanged bool `json:"listChanged,omitempty"`
	} `json:"prompts,omitempty"`
	// Present if the server offers any resources to read.
	Resources *struct {
		// Whether this server supports subscribing to resource updates.
		Subscribe bool `json:"subscribe,omitempty"`
		// Whether this server supports notifications for changes to the resource
		// list.
		ListChanged bool `json:"listChanged,omitempty"`
	} `json:"resources,omitempty"`
	// Present if the server supports sending sampling requests to clients.
	Sampling *SamplingCapability `json:"sampling,omitempty"`
	// Present if the server offers any tools to call.
	Tools *struct {
		// Whether this server supports notifications for changes to the tool list.
		ListChanged bool `json:"listChanged,omitempty"`
	} `json:"tools,omitempty"`
	// Present if the server supports elicitation requests to the client.
	Elicitation *ElicitationCapability `json:"elicitation,omitempty"`
	// Present if the server supports roots requests to the client.
	Roots *struct{} `json:"roots,omitempty"`
	// Present if the server supports task-based execution.
	Tasks *TasksCapability `json:"tasks,omitempty"`
	// Present if the server supports completions requests to the client.
	Completions *struct{} `json:"completions,omitempty"`
}

// IconTheme is the background theme an icon is designed to be displayed on.
type IconTheme string

const (
	// IconThemeLight indicates the icon is designed for use with a light background.
	IconThemeLight IconTheme = "light"
	// IconThemeDark indicates the icon is designed for use with a dark background.
	IconThemeDark IconTheme = "dark"
)

// Icon represents a visual identifier for MCP entities.
//
// Security considerations:
//   - Clients MUST support at least image/png and image/jpeg MIME types
//   - Clients SHOULD support image/svg+xml and image/webp
//   - Icons should be treated as untrusted input
//   - URI scheme validation (HTTPS or data URI only)
//   - Size/dimension limits to prevent resource exhaustion
type Icon struct {
	// URI pointing to the icon resource (HTTPS URL or data URI)
	Src string `json:"src"`

	// Optional MIME type (e.g., "image/png", "image/svg+xml")
	MIMEType string `json:"mimeType,omitempty"`

	// Optional size specifications (e.g., ["48x48"], ["any"] for SVG)
	Sizes []string `json:"sizes,omitempty"`

	// Theme is an optional specifier for the background theme this icon is designed for.
	// Use IconThemeLight for light backgrounds or IconThemeDark for dark backgrounds.
	Theme IconTheme `json:"theme,omitempty"`
}

// Implementation describes the name and version of an MCP implementation.
type Implementation struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	WebsiteURL  string `json:"websiteUrl,omitempty"`
	// Icons provides visual identifiers for the implementation
	Icons []Icon `json:"icons,omitempty"`
}

/* Ping */

// PingRequest represents a ping, issued by either the server or the client,
// to check that the other party is still alive. The receiver must promptly respond,
// or else may be disconnected.
type PingRequest struct {
	Request
	Header http.Header `json:"-"`
}

/* Progress notifications */

// ProgressNotification is an out-of-band notification used to inform the
// receiver of a progress update for a long-running request.
type ProgressNotification struct {
	Notification
	Params ProgressNotificationParams `json:"params"`
}

type ProgressNotificationParams struct {
	// The progress token which was given in the initial request, used to
	// associate this notification with the request that is proceeding.
	ProgressToken ProgressToken `json:"progressToken"`
	// The progress thus far. This should increase every time progress is made,
	// even if the total is unknown.
	Progress float64 `json:"progress"`
	// Total number of items to process (or total progress required), if known.
	Total float64 `json:"total,omitempty"`
	// Message related to progress. This should provide relevant human-readable
	// progress information.
	Message string `json:"message,omitempty"`
}

/* Pagination */

type PaginatedRequest struct {
	Request
	Params PaginatedParams `json:"params,omitzero"`
}

type PaginatedParams struct {
	// An opaque token representing the current pagination position.
	// If provided, the server should return results starting after this cursor.
	Cursor Cursor `json:"cursor,omitempty"`
	// Meta carries protocol-level metadata. PaginatedRequest embeds Request
	// and shadows its Params with this type, so Meta must be declared here
	// to be marshaled on paginated requests (tools/list, resources/list,
	// resources/templates/list, prompts/list, tasks/list).
	Meta *Meta `json:"_meta,omitempty"`
}

type PaginatedResult struct {
	CacheableResult
	// An opaque token representing the pagination position after the last
	// returned result.
	// If present, there may be more results available.
	NextCursor Cursor `json:"nextCursor,omitempty"`
}

/* Resources */

// ListResourcesRequest is sent from the client to request a list of resources
// the server has.
type ListResourcesRequest struct {
	PaginatedRequest
	Header http.Header `json:"-"`
}

// ListResourcesResult is the server's response to a resources/list request
// from the client.
type ListResourcesResult struct {
	PaginatedResult
	Resources []Resource `json:"resources"`
}

// ListResourceTemplatesRequest is sent from the client to request a list of
// resource templates the server has.
type ListResourceTemplatesRequest struct {
	PaginatedRequest
	Header http.Header `json:"-"`
}

// ListResourceTemplatesResult is the server's response to a
// resources/templates/list request from the client.
type ListResourceTemplatesResult struct {
	PaginatedResult
	ResourceTemplates []ResourceTemplate `json:"resourceTemplates"`
}

// ReadResourceRequest is sent from the client to the server, to read a
// specific resource URI.
type ReadResourceRequest struct {
	Request
	Header http.Header        `json:"-"`
	Params ReadResourceParams `json:"params"`
}

type ReadResourceParams struct {
	// The URI of the resource to read. The URI can use any protocol; it is up
	// to the server how to interpret it.
	URI string `json:"uri"`
	// Arguments to pass to the resource handler
	Arguments map[string]any `json:"arguments,omitempty"`
	// Meta carries protocol-level metadata (e.g. W3C traceparent, progressToken).
	Meta *Meta `json:"_meta,omitempty"`
	MultiRoundTripParams
}

// ReadResourceResult is the server's response to a resources/read request
// from the client.
type ReadResourceResult struct {
	CacheableResult
	MultiRoundTripResult
	Contents []ResourceContents `json:"contents"` // Can be TextResourceContents or BlobResourceContents
}

// ResourceListChangedNotification is an optional notification from the server
// to the client, informing it that the list of resources it can read from has
// changed. This may be issued by servers without any previous subscription from
// the client.
type ResourceListChangedNotification struct {
	Notification
}

// SubscribeRequest is sent from the client to request resources/updated
// notifications from the server whenever a particular resource changes.
type SubscribeRequest struct {
	Request
	Params SubscribeParams `json:"params"`
	Header http.Header     `json:"-"`
}

type SubscribeParams struct {
	// The URI of the resource to subscribe to. The URI can use any protocol; it
	// is up to the server how to interpret it.
	URI string `json:"uri"`
}

// UnsubscribeRequest is sent from the client to request cancellation of
// resources/updated notifications from the server. This should follow a previous
// resources/subscribe request.
type UnsubscribeRequest struct {
	Request
	Params UnsubscribeParams `json:"params"`
	Header http.Header       `json:"-"`
}

type UnsubscribeParams struct {
	// The URI of the resource to unsubscribe from.
	URI string `json:"uri"`
}

// ResourceUpdatedNotification is a notification from the server to the client,
// informing it that a resource has changed and may need to be read again. This
// should only be sent if the client previously sent a resources/subscribe request.
type ResourceUpdatedNotification struct {
	Notification
	Params ResourceUpdatedNotificationParams `json:"params"`
}
type ResourceUpdatedNotificationParams struct {
	// The URI of the resource that has been updated. This might be a sub-
	// resource of the one that the client actually subscribed to.
	URI string `json:"uri"`
}

// Resource represents a known resource that the server is capable of reading.
type Resource struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta `json:"_meta,omitempty"`
	// The URI of this resource.
	URI string `json:"uri"`
	// A human-readable name for this resource.
	//
	// This can be used by clients to populate UI elements.
	Name string `json:"name"`
	// Title is an optional human-readable, UI-friendly display name for this resource.
	// If not provided, clients should fall back to Name.
	Title string `json:"title,omitempty"`
	// A description of what this resource represents.
	//
	// This can be used by clients to improve the LLM's understanding of
	// available resources. It can be thought of like a "hint" to the model.
	Description string `json:"description,omitempty"`
	// The MIME type of this resource, if known.
	MIMEType string `json:"mimeType,omitempty"`
	// Icons provides visual identifiers for the resource
	Icons []Icon `json:"icons,omitempty"`
	// Size is the size of the raw resource content, in bytes (i.e., before base64
	// encoding or any tokenization), if known. This can be used by hosts to
	// display file sizes and estimate context window usage.
	//
	// A pointer is used so that an explicit zero size remains distinguishable
	// from an unset value.
	Size *int64 `json:"size,omitempty"`
}

// GetName returns the name of the resource.
func (r Resource) GetName() string {
	return r.Name
}

// ResourceTemplate represents a template description for resources available
// on the server.
type ResourceTemplate struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta `json:"_meta,omitempty"`
	// A URI template (according to RFC 6570) that can be used to construct
	// resource URIs.
	URITemplate *URITemplate `json:"uriTemplate"`
	// A human-readable name for the type of resource this template refers to.
	//
	// This can be used by clients to populate UI elements.
	Name string `json:"name"`
	// Title is an optional human-readable, UI-friendly display name for this resource template.
	// If not provided, clients should fall back to Name.
	Title string `json:"title,omitempty"`
	// A description of what this template is for.
	//
	// This can be used by clients to improve the LLM's understanding of
	// available resources. It can be thought of like a "hint" to the model.
	Description string `json:"description,omitempty"`
	// The MIME type for all resources that match this template. This should only
	// be included if all resources matching this template have the same type.
	MIMEType string `json:"mimeType,omitempty"`
	// Icons provides visual identifiers for the resource template
	Icons []Icon `json:"icons,omitempty"`
}

// GetName returns the name of the resourceTemplate.
func (rt ResourceTemplate) GetName() string {
	return rt.Name
}

// ResourceContents represents the contents of a specific resource or sub-
// resource.
type ResourceContents interface {
	isResourceContents()
}

type TextResourceContents struct {
	// Raw per‑resource metadata; pass‑through as defined by MCP. Not the same as mcp.Meta.
	// Allows _meta to be used for MCP-UI features for example. Does not assume any specific format.
	Meta map[string]any `json:"_meta,omitempty"`
	// The URI of this resource.
	URI string `json:"uri"`
	// The MIME type of this resource, if known.
	MIMEType string `json:"mimeType,omitempty"`
	// The text of the item. This must only be set if the item can actually be
	// represented as text (not binary data).
	Text string `json:"text"`
}

func (TextResourceContents) isResourceContents() {}

type BlobResourceContents struct {
	// Raw per‑resource metadata; pass‑through as defined by MCP. Not the same as mcp.Meta.
	// Allows _meta to be used for MCP-UI features for example. Does not assume any specific format.
	Meta map[string]any `json:"_meta,omitempty"`
	// The URI of this resource.
	URI string `json:"uri"`
	// The MIME type of this resource, if known.
	MIMEType string `json:"mimeType,omitempty"`
	// A base64-encoded string representing the binary data of the item.
	Blob string `json:"blob"`
}

func (BlobResourceContents) isResourceContents() {}

/* Logging */

// SetLevelRequest is a request from the client to the server, to enable or
// adjust logging.
type SetLevelRequest struct {
	Request
	Params SetLevelParams `json:"params"`
	Header http.Header    `json:"-"`
}

type SetLevelParams struct {
	// The level of logging that the client wants to receive from the server.
	// The server should send all logs at this level and higher (i.e., more severe) to
	// the client as notifications/logging/message.
	Level LoggingLevel `json:"level"`
}

// LoggingMessageNotification is a notification of a log message passed from
// server to client. If no logging/setLevel request has been sent from the client,
// the server MAY decide which messages to send automatically.
type LoggingMessageNotification struct {
	Notification
	Params LoggingMessageNotificationParams `json:"params"`
}

type LoggingMessageNotificationParams struct {
	// The severity of this log message.
	Level LoggingLevel `json:"level"`
	// An optional name of the logger issuing this message.
	Logger string `json:"logger,omitempty"`
	// The data to be logged, such as a string message or an object. Any JSON
	// serializable type is allowed here.
	Data any `json:"data"`
}

// LoggingLevel represents the severity of a log message.
//
// These map to syslog message severities, as specified in RFC-5424:
// https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
type LoggingLevel string

const (
	LoggingLevelDebug     LoggingLevel = "debug"
	LoggingLevelInfo      LoggingLevel = "info"
	LoggingLevelNotice    LoggingLevel = "notice"
	LoggingLevelWarning   LoggingLevel = "warning"
	LoggingLevelError     LoggingLevel = "error"
	LoggingLevelCritical  LoggingLevel = "critical"
	LoggingLevelAlert     LoggingLevel = "alert"
	LoggingLevelEmergency LoggingLevel = "emergency"
)

var levelToInt = map[LoggingLevel]int{
	LoggingLevelDebug:     0,
	LoggingLevelInfo:      1,
	LoggingLevelNotice:    2,
	LoggingLevelWarning:   3,
	LoggingLevelError:     4,
	LoggingLevelCritical:  5,
	LoggingLevelAlert:     6,
	LoggingLevelEmergency: 7,
}

func (l LoggingLevel) ShouldSendTo(minLevel LoggingLevel) bool {
	ia, oka := levelToInt[l]
	ib, okb := levelToInt[minLevel]
	if !oka || !okb {
		return false
	}
	return ia >= ib
}

/* Elicitation */

// ElicitationRequest is a request from the server to the client to request additional
// information from the user during an interaction.
type ElicitationRequest struct {
	Request
	Params ElicitationParams `json:"params"`
}

// ElicitationParams contains the parameters for an elicitation request.
type ElicitationParams struct {
	Meta *Meta `json:"_meta,omitempty"`
	// Mode specifies the type of elicitation: "form" or "url". Defaults to "form".
	Mode string `json:"mode,omitempty"`
	// A human-readable message explaining what information is being requested and why.
	Message string `json:"message"`

	// Form mode fields

	// A JSON Schema defining the expected structure of the user's response.
	RequestedSchema any `json:"requestedSchema,omitempty"`

	// URL mode fields

	// ElicitationID is a unique identifier for the elicitation request.
	ElicitationID string `json:"elicitationId,omitempty"`
	// URL is the URL to be opened by the user.
	URL string `json:"url,omitempty"`
}

// Validate checks if the elicitation parameters are valid.
func (p ElicitationParams) Validate() error {
	mode := p.Mode
	if mode == "" {
		mode = ElicitationModeForm
	}

	switch mode {
	case ElicitationModeForm:
		if p.RequestedSchema == nil {
			return fmt.Errorf("requestedSchema is required for form elicitation")
		}
	case ElicitationModeURL:
		if p.ElicitationID == "" {
			return fmt.Errorf("elicitationId is required for url elicitation")
		}
		if p.URL == "" {
			return fmt.Errorf("url is required for url elicitation")
		}
	default:
		return fmt.Errorf("invalid elicitation mode: %s", mode)
	}

	return nil
}

// ElicitationResult represents the result of an elicitation request.
type ElicitationResult struct {
	Result
	ElicitationResponse
}

// ElicitationResponse represents the user's response to an elicitation request.
type ElicitationResponse struct {
	// Action indicates whether the user accepted, declined, or cancelled.
	Action ElicitationResponseAction `json:"action"`
	// Content contains the user's response data if they accepted.
	// Should conform to the requestedSchema from the ElicitationRequest.
	Content any `json:"content,omitempty"`
}

// ElicitationResponseAction indicates how the user responded to an elicitation request.
type ElicitationResponseAction string

const (
	// ElicitationResponseActionAccept indicates the user provided the requested information.
	ElicitationResponseActionAccept ElicitationResponseAction = "accept"
	// ElicitationResponseActionDecline indicates the user explicitly declined to provide information.
	ElicitationResponseActionDecline ElicitationResponseAction = "decline"
	// ElicitationResponseActionCancel indicates the user cancelled without making a choice.
	ElicitationResponseActionCancel ElicitationResponseAction = "cancel"
)

/* Sampling */

const (
	// MethodSamplingCreateMessage allows servers to request LLM completions from clients
	MethodSamplingCreateMessage MCPMethod = "sampling/createMessage"
)

// CreateMessageRequest is a request from the server to sample an LLM via the
// client. The client has full discretion over which model to select. The client
// should also inform the user before beginning sampling, to allow them to inspect
// the request (human in the loop) and decide whether to approve it.
type CreateMessageRequest struct {
	Request
	CreateMessageParams `json:"params"`
}

type CreateMessageParams struct {
	Messages         []SamplingMessage `json:"messages"`
	ModelPreferences *ModelPreferences `json:"modelPreferences,omitempty"`
	SystemPrompt     string            `json:"systemPrompt,omitempty"`
	IncludeContext   string            `json:"includeContext,omitempty"`
	Temperature      float64           `json:"temperature,omitempty"`
	MaxTokens        int               `json:"maxTokens"`
	StopSequences    []string          `json:"stopSequences,omitempty"`
	Metadata         any               `json:"metadata,omitempty"`
	// Tools the model may use during generation.
	//
	// Per the 2025-11-25 spec, the client MUST return an error if this field
	// is provided but ClientCapabilities.Sampling.Tools is not declared.
	Tools []Tool `json:"tools,omitempty"`
	// ToolChoice controls how the model uses tools during generation.
	//
	// Per the 2025-11-25 spec, the client MUST return an error if this field
	// is provided but ClientCapabilities.Sampling.Tools is not declared.
	// When omitted the client defaults to {Mode: ToolChoiceModeAuto}.
	ToolChoice *ToolChoice `json:"toolChoice,omitempty"`
}

// ToolChoiceMode controls tool selection behaviour during sampling.
type ToolChoiceMode string

const (
	// ToolChoiceModeAuto lets the model decide whether to use tools. This is
	// the default when ToolChoice is omitted.
	ToolChoiceModeAuto ToolChoiceMode = "auto"
	// ToolChoiceModeRequired forces the model to call at least one tool.
	ToolChoiceModeRequired ToolChoiceMode = "required"
	// ToolChoiceModeNone disables tool use for this sampling request.
	ToolChoiceModeNone ToolChoiceMode = "none"
)

// ToolChoice controls tool selection behaviour for a sampling request as
// defined by the 2025-11-25 protocol revision.
type ToolChoice struct {
	// Mode controls tool selection. Empty is treated as ToolChoiceModeAuto by
	// the client.
	Mode ToolChoiceMode `json:"mode,omitempty"`
}

// CreateMessageResult is the client's response to a sampling/create_message
// request from the server. The client should inform the user before returning the
// sampled message, to allow them to inspect the response (human in the loop) and
// decide whether to allow the server to see it.
type CreateMessageResult struct {
	Result
	SamplingMessage
	// The name of the model that generated the message.
	Model string `json:"model"`
	// The reason why sampling stopped, if known.
	StopReason string `json:"stopReason,omitempty"`
}

// SamplingMessage describes a message issued to or received from an LLM API.
type SamplingMessage struct {
	Role    Role `json:"role"`
	Content any  `json:"content"` // Can be TextContent, ImageContent, AudioContent, ToolUseContent or ToolResultContent, or a []Content of them
}

type Annotations struct {
	// Describes who the intended customer of this object or data is.
	//
	// It can include multiple entries to indicate content useful for multiple
	// audiences (e.g., `["user", "assistant"]`).
	Audience []Role `json:"audience,omitempty"`

	// Describes how important this data is for operating the server.
	//
	// A value of 1 means "most important," and indicates that the data is
	// effectively required, while 0 means "least important," and indicates that
	// the data is entirely optional.
	// Priority ranges from 0.0 to 1.0 (1 = most important, 0 = least important).
	Priority *float64 `json:"priority,omitempty"`
	// ISO 8601 formatted timestamp (e.g., "2025-01-12T15:00:58Z")
	LastModified string `json:"lastModified,omitempty"`
}

// Annotated is the base for objects that include optional annotations for the
// client. The client can use annotations to inform how objects are used or
// displayed
type Annotated struct {
	Annotations *Annotations `json:"annotations,omitempty"`
}

type Content interface {
	isContent()
}

// TextContent represents text provided to or from an LLM.
// It must have Type set to "text".
type TextContent struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "text"
	// The text content of the message.
	Text string `json:"text"`
}

func (TextContent) isContent() {}

// ImageContent represents an image provided to or from an LLM.
// It must have Type set to "image".
type ImageContent struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "image"
	// The base64-encoded image data.
	Data string `json:"data"`
	// The MIME type of the image. Different providers may support different image types.
	MIMEType string `json:"mimeType"`
}

func (ImageContent) isContent() {}

// AudioContent represents the contents of audio, embedded into a prompt or tool call result.
// It must have Type set to "audio".
type AudioContent struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "audio"
	// The base64-encoded audio data.
	Data string `json:"data"`
	// The MIME type of the audio. Different providers may support different audio types.
	MIMEType string `json:"mimeType"`
}

func (AudioContent) isContent() {}

// ResourceLink represents a link to a resource that the client can access.
type ResourceLink struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "resource_link"
	// The URI of the resource.
	URI string `json:"uri"`
	// The name of the resource.
	Name string `json:"name"`
	// Title is an optional human-readable, UI-friendly display name for this resource.
	// If not provided, clients should fall back to Name.
	Title string `json:"title,omitempty"`
	// The description of the resource.
	Description string `json:"description"`
	// The MIME type of the resource.
	MIMEType string `json:"mimeType"`
	// Size is the size of the raw resource content, in bytes (i.e., before base64
	// encoding or any tokenization), if known. This can be used by hosts to
	// display file sizes and estimate context window usage.
	//
	// A pointer is used so that an explicit zero size remains distinguishable
	// from an unset value.
	Size *int64 `json:"size,omitempty"`
}

func (ResourceLink) isContent() {}

// EmbeddedResource represents the contents of a resource, embedded into a prompt or tool call result.
//
// It is up to the client how best to render embedded resources for the
// benefit of the LLM and/or the user.
type EmbeddedResource struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta     *Meta            `json:"_meta,omitempty"`
	Type     string           `json:"type"`
	Resource ResourceContents `json:"resource"`
}

func (EmbeddedResource) isContent() {}

// UnmarshalJSON implements custom JSON unmarshaling for EmbeddedResource
// to handle the nested ResourceContents interface.
func (e *EmbeddedResource) UnmarshalJSON(data []byte) error {
	var raw struct {
		Annotated
		Meta     *Meta           `json:"_meta,omitempty"`
		Type     string          `json:"type"`
		Resource json.RawMessage `json:"resource"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	var resourceFields map[string]json.RawMessage
	if err := json.Unmarshal(raw.Resource, &resourceFields); err != nil {
		return fmt.Errorf("unmarshaling embedded resource: %w", err)
	}

	var resource ResourceContents
	if _, ok := resourceFields["text"]; ok {
		var textResource TextResourceContents
		if err := json.Unmarshal(raw.Resource, &textResource); err != nil {
			return fmt.Errorf("unmarshaling embedded text resource: %w", err)
		}
		if textResource.URI == "" {
			return fmt.Errorf("unmarshaling embedded text resource: %w", ErrEmbeddedResourceMissingURI)
		}
		resource = textResource
	} else if _, ok := resourceFields["blob"]; ok {
		var blobResource BlobResourceContents
		if err := json.Unmarshal(raw.Resource, &blobResource); err != nil {
			return fmt.Errorf("unmarshaling embedded blob resource: %w", err)
		}
		if blobResource.URI == "" {
			return fmt.Errorf("unmarshaling embedded blob resource: %w", ErrEmbeddedResourceMissingURI)
		}
		resource = blobResource
	} else {
		return fmt.Errorf("unmarshaling embedded resource: %w", ErrEmbeddedResourceMissingVariant)
	}

	e.Annotated = raw.Annotated
	e.Meta = raw.Meta
	e.Type = raw.Type
	e.Resource = resource
	return nil
}

// ToolUseContent represents a request from the assistant to call a tool within a sampling message.
// It must have Type set to "tool_use".
type ToolUseContent struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "tool_use"
	// ID is a unique identifier for this tool use, used to match tool results to their corresponding tool uses.
	ID string `json:"id"`
	// Name is the name of the tool to call.
	Name string `json:"name"`
	// Input contains the arguments to pass to the tool, conforming to the tool's input schema.
	Input any `json:"input"`
}

func (ToolUseContent) isContent() {}

// ToolResultContent represents the result of a tool invocation within a sampling message.
// It must have Type set to "tool_result".
type ToolResultContent struct {
	Annotated
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta  `json:"_meta,omitempty"`
	Type string `json:"type"` // Must be "tool_result"
	// ToolUseID is the ID of the tool use this result corresponds to.
	// This MUST match the ID from a previous ToolUseContent.
	ToolUseID string `json:"toolUseId"`
	// Content is the unstructured result content of the tool use.
	Content []Content `json:"content"`
	// StructuredContent is an optional structured result of the tool use.
	// If the tool defined an outputSchema, this SHOULD conform to that schema.
	StructuredContent any `json:"structuredContent,omitempty"`
	// RawStructuredContent preserves the original JSON bytes for structuredContent when
	// unmarshaled from a wire message.
	RawStructuredContent json.RawMessage `json:"-"`
	// Whether the tool use resulted in an error.
	IsError bool `json:"isError,omitempty"`
}

func (ToolResultContent) isContent() {}

// MarshalJSON implements custom JSON marshaling for ToolResultContent.
// structuredContent is written from RawStructuredContent when it is set.
func (t ToolResultContent) MarshalJSON() ([]byte, error) {
	type alias ToolResultContent
	out := struct {
		alias
		StructuredContent any `json:"structuredContent,omitempty"`
	}{alias: alias(t), StructuredContent: t.StructuredContent}
	if len(t.RawStructuredContent) > 0 {
		out.StructuredContent = t.RawStructuredContent
	}
	return json.Marshal(out)
}

// toolResultContentJSON is a helper type for unmarshaling ToolResultContent.
type toolResultContentJSON struct {
	Annotated
	Meta              *Meta             `json:"_meta,omitempty"`
	Type              string            `json:"type"`
	ToolUseID         string            `json:"toolUseId"`
	Content           []json.RawMessage `json:"content"`
	StructuredContent json.RawMessage   `json:"structuredContent,omitempty"`
	IsError           bool              `json:"isError,omitempty"`
}

// UnmarshalJSON implements custom JSON unmarshaling for ToolResultContent
// to handle the nested Content interface slice.
func (t *ToolResultContent) UnmarshalJSON(data []byte) error {
	var raw toolResultContentJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	t.Annotated = raw.Annotated
	t.Meta = raw.Meta
	t.Type = raw.Type
	t.ToolUseID = raw.ToolUseID
	t.IsError = raw.IsError

	t.RawStructuredContent = nil
	t.StructuredContent = nil
	if len(raw.StructuredContent) > 0 {
		t.RawStructuredContent = append(json.RawMessage(nil), raw.StructuredContent...)
		if err := json.Unmarshal(raw.StructuredContent, &t.StructuredContent); err != nil {
			return fmt.Errorf("unmarshaling tool result structured content: %w", err)
		}
	}

	t.Content = nil
	if raw.Content != nil {
		t.Content = make([]Content, 0, len(raw.Content))
		for _, rawContent := range raw.Content {
			c, err := UnmarshalContent(rawContent)
			if err != nil {
				return fmt.Errorf("unmarshaling tool result content: %w", err)
			}
			t.Content = append(t.Content, c)
		}
	}
	return nil
}

// ModelPreferences represents the server's preferences for model selection,
// requested of the client during sampling.
//
// Because LLMs can vary along multiple dimensions, choosing the "best" modelis
// rarely straightforward.  Different models excel in different areas—some are
// faster but less capable, others are more capable but more expensive, and so
// on. This interface allows servers to express their priorities across multiple
// dimensions to help clients make an appropriate selection for their use case.
//
// These preferences are always advisory. The client MAY ignore them. It is also
// up to the client to decide how to interpret these preferences and how to
// balance them against other considerations.
type ModelPreferences struct {
	// Optional hints to use for model selection.
	//
	// If multiple hints are specified, the client MUST evaluate them in order
	// (such that the first match is taken).
	//
	// The client SHOULD prioritize these hints over the numeric priorities, but
	// MAY still use the priorities to select from ambiguous matches.
	Hints []ModelHint `json:"hints,omitempty"`

	// How much to prioritize cost when selecting a model. A value of 0 means cost
	// is not important, while a value of 1 means cost is the most important
	// factor.
	CostPriority float64 `json:"costPriority,omitempty"`

	// How much to prioritize sampling speed (latency) when selecting a model. A
	// value of 0 means speed is not important, while a value of 1 means speed is
	// the most important factor.
	SpeedPriority float64 `json:"speedPriority,omitempty"`

	// How much to prioritize intelligence and capabilities when selecting a
	// model. A value of 0 means intelligence is not important, while a value of 1
	// means intelligence is the most important factor.
	IntelligencePriority float64 `json:"intelligencePriority,omitempty"`
}

// ModelHint represents hints to use for model selection.
//
// Keys not declared here are currently left unspecified by the spec and are up
// to the client to interpret.
type ModelHint struct {
	// A hint for a model name.
	//
	// The client SHOULD treat this as a substring of a model name; for example:
	//  - `claude-3-5-sonnet` should match `claude-3-5-sonnet-20241022`
	//  - `sonnet` should match `claude-3-5-sonnet-20241022`, `claude-3-sonnet-20240229`, etc.
	//  - `claude` should match any Claude model
	//
	// The client MAY also map the string to a different provider's model name or
	// a different model family, as long as it fills a similar niche; for example:
	//  - `gemini-1.5-flash` could match `claude-3-haiku-20240307`
	Name string `json:"name,omitempty"`
}

/* Autocomplete */

// CompleteRequest is a request from the client to the server, to ask for completion options.
type CompleteRequest struct {
	Request
	Params CompleteParams `json:"params"`
	Header http.Header    `json:"-"`
}

// CompleteParams are the parameters for a completion/complete request
type CompleteParams struct {
	Ref      any              `json:"ref"` // Can be PromptReference or ResourceReference
	Argument CompleteArgument `json:"argument"`
	Context  CompleteContext  `json:"context"`
}

func (p *CompleteParams) UnmarshalJSON(data []byte) error {
	// Use a temporary type to avoid infinite recursion on UnmarshalJSON
	type Alias CompleteParams
	aux := &struct {
		// Use RawMessage to delay unmarshalling until after the type is known
		Ref json.RawMessage `json:"ref"`
		*Alias
	}{
		Alias: (*Alias)(p),
	}
	if err := json.Unmarshal(data, aux); err != nil {
		return err
	}
	// Use a temporary "type peek" struct to determine the type
	var typePeek struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(aux.Ref, &typePeek); err != nil {
		return err
	}
	switch typePeek.Type {
	case "ref/prompt":
		var prompt PromptReference
		if err := json.Unmarshal(aux.Ref, &prompt); err != nil {
			return err
		}
		p.Ref = prompt
	case "ref/resource":
		var resource ResourceReference
		if err := json.Unmarshal(aux.Ref, &resource); err != nil {
			return err
		}
		p.Ref = resource
	default:
		return fmt.Errorf("unknown reference type: %s", typePeek.Type)
	}
	return nil
}

// CompleteResult is the server's response to a completion/complete request
type CompleteResult struct {
	Result
	Completion Completion `json:"completion"`
}

// CompleteArgument is an argument to a completion request
type CompleteArgument struct {
	// The name of the argument
	Name string `json:"name"`
	// The value of the argument to use for completion matching.
	Value string `json:"value"`
}

// CompleteContext is the context about already-resolved arguments
type CompleteContext struct {
	Arguments map[string]string `json:"arguments,omitempty"`
}

// Completion is the server's response to a completion/complete request
type Completion struct {
	// An array of completion values. Must not exceed 100 items.
	Values []string `json:"values"`
	// The total number of completion options available. This can exceed the
	// number of values actually sent in the response.
	Total int `json:"total,omitempty"`
	// Indicates whether there are additional completion options beyond those
	// provided in the current response, even if the exact total is unknown.
	HasMore bool `json:"hasMore,omitempty"`
}

// ResourceReference is a reference to a resource or resource template definition.
type ResourceReference struct {
	Type string `json:"type"`
	// The URI or URI template of the resource.
	URI string `json:"uri"`
}

// PromptReference identifies a prompt.
type PromptReference struct {
	Type string `json:"type"`
	// The name of the prompt or prompt template
	Name string `json:"name"`
}

/* Roots */

// ListRootsRequest is sent from the server to request a list of root URIs from the client. Roots allow
// servers to ask for specific directories or files to operate on. A common example
// for roots is providing a set of repositories or directories a server should operate
// on.
//
// This request is typically used when the server needs to understand the file system
// structure or access specific locations that the client has permission to read from.
type ListRootsRequest struct {
	Request
}

// ListRootsResult is the client's response to a roots/list request from the server.
// This result contains an array of Root objects, each representing a root directory
// or file that the server can operate on.
type ListRootsResult struct {
	Result
	Roots []Root `json:"roots"`
}

// Root represents a root directory or file that the server can operate on.
type Root struct {
	// Meta is a metadata object that is reserved by MCP for storing additional information.
	Meta *Meta `json:"_meta,omitempty"`
	// The URI identifying the root. This *must* start with file:// for now.
	// This restriction may be relaxed in future versions of the protocol to allow
	// other URI schemes.
	URI string `json:"uri"`
	// An optional name for the root. This can be used to provide a human-readable
	// identifier for the root, which may be useful for display purposes or for
	// referencing the root in other parts of the application.
	Name string `json:"name,omitempty"`
}

// RootsListChangedNotification is a notification from the client to the
// server, informing it that the list of roots has changed.
// This notification should be sent whenever the client adds, removes, or modifies any root.
// The server should then request an updated list of roots using the ListRootsRequest.
type RootsListChangedNotification struct {
	Notification
}

/* Tasks */

// TasksCapability represents the task capabilities that a client or server may support.
// Tasks enable long-running, asynchronous operations with status polling.
type TasksCapability struct {
	// Whether the party supports the tasks/list operation.
	List *struct{} `json:"list,omitempty"`
	// Whether the party supports the tasks/cancel operation.
	Cancel *struct{} `json:"cancel,omitempty"`
	// Requests that can be augmented with task metadata.
	Requests *TaskRequestsCapability `json:"requests,omitempty"`
}

// TaskRequestsCapability indicates which request types support task augmentation.
type TaskRequestsCapability struct {
	// Tool-related capabilities.
	Tools *struct {
		// Whether tools/call can be augmented with task metadata.
		Call *struct{} `json:"call,omitempty"`
	} `json:"tools,omitempty"`
	// Sampling-related capabilities.
	Sampling *struct {
		// Whether sampling/createMessage can be augmented with task metadata.
		CreateMessage *struct{} `json:"createMessage,omitempty"`
	} `json:"sampling,omitempty"`
	// Elicitation-related capabilities.
	Elicitation *struct {
		// Whether elicitation/create can be augmented with task metadata.
		Create *struct{} `json:"create,omitempty"`
	} `json:"elicitation,omitempty"`
}

// TaskStatus represents the execution state of a task.
type TaskStatus string

const (
	// TaskStatusWorking indicates the request is currently being processed.
	TaskStatusWorking TaskStatus = "working"
	// TaskStatusInputRequired indicates the receiver needs input from the requestor.
	// NOTE: This status is defined by the spec but not yet implemented in this SDK.
	// The input_required flow requires integration with elicitation which is planned
	// for a future release.
	TaskStatusInputRequired TaskStatus = "input_required"
	// TaskStatusCompleted indicates the request completed successfully.
	TaskStatusCompleted TaskStatus = "completed"
	// TaskStatusFailed indicates the request did not complete successfully.
	TaskStatusFailed TaskStatus = "failed"
	// TaskStatusCancelled indicates the request was cancelled before completion.
	TaskStatusCancelled TaskStatus = "cancelled"
)

// IsTerminal returns true if the task status is terminal (completed, failed, or cancelled).
func (s TaskStatus) IsTerminal() bool {
	return s == TaskStatusCompleted || s == TaskStatusFailed || s == TaskStatusCancelled
}

// Task represents the execution state of a request.
type Task struct {
	// Unique identifier for the task.
	TaskId string `json:"taskId"`
	// Current state of the task execution.
	Status TaskStatus `json:"status"`
	// Optional human-readable message describing the current state.
	StatusMessage string `json:"statusMessage,omitempty"`
	// ISO 8601 timestamp when the task was created.
	CreatedAt string `json:"createdAt"`
	// ISO 8601 timestamp when the task was last updated.
	LastUpdatedAt string `json:"lastUpdatedAt"`
	// Time in milliseconds from creation before task may be deleted.
	// If null, the task has no expiration.
	TTL *int64 `json:"ttl"`
	// Suggested time in milliseconds between status checks.
	PollInterval *int64 `json:"pollInterval,omitempty"`
}

// GetName returns the task ID, implementing the Named interface for pagination.
func (t Task) GetName() string {
	return t.TaskId
}

// TaskParams represents the task metadata included when augmenting a request.
type TaskParams struct {
	// Requested duration in milliseconds to retain task from creation.
	TTL *int64 `json:"ttl,omitempty"`
}

// CreateTaskResult is returned immediately when a task-augmented request is accepted.
// It contains task metadata rather than the actual operation result.
type CreateTaskResult struct {
	Result
	Task              Task      `json:"task"`
	Content           []Content `json:"-"`
	StructuredContent any       `json:"-"`
	IsError           bool      `json:"-"`
}

// GetTaskRequest retrieves the current status of a task.
type GetTaskRequest struct {
	Request
	Header http.Header   `json:"-"`
	Params GetTaskParams `json:"params"`
}

type GetTaskParams struct {
	TaskId string `json:"taskId"`
}

// GetTaskResult returns the current state of a task.
type GetTaskResult struct {
	Result
	Task
}

// ListTasksRequest retrieves a paginated list of tasks.
type ListTasksRequest struct {
	PaginatedRequest
	Header http.Header `json:"-"`
}

// ListTasksResult returns a list of tasks.
type ListTasksResult struct {
	PaginatedResult
	Tasks []Task `json:"tasks"`
}

// TaskResultRequest retrieves the result of a completed task.
type TaskResultRequest struct {
	Request
	Header http.Header      `json:"-"`
	Params TaskResultParams `json:"params"`
}

type TaskResultParams struct {
	TaskId string `json:"taskId"`
}

// TaskResultResult contains the actual operation result.
// For task-augmented tool calls, this embeds the CallToolResult fields.
type TaskResultResult struct {
	Result
	// Tool call result fields (for task-augmented tool calls)
	Content           []Content `json:"content"`
	StructuredContent any       `json:"structuredContent,omitempty"`
	// RawStructuredContent preserves structured JSON precision when forwarding a parsed result.
	RawStructuredContent json.RawMessage `json:"-"`
	IsError              bool            `json:"isError,omitempty"`
}

// MarshalJSON preserves structured content and emits an array for tool result content.
func (r TaskResultResult) MarshalJSON() ([]byte, error) {
	if r.Content == nil {
		r.Content = []Content{}
	}
	type alias TaskResultResult
	out := struct {
		alias
		StructuredContent any `json:"structuredContent,omitempty"`
	}{alias: alias(r), StructuredContent: r.StructuredContent}
	if len(r.RawStructuredContent) > 0 {
		out.StructuredContent = r.RawStructuredContent
	}
	return json.Marshal(out)
}

// CancelTaskRequest cancels an in-progress task.
type CancelTaskRequest struct {
	Request
	Header http.Header      `json:"-"`
	Params CancelTaskParams `json:"params"`
}

type CancelTaskParams struct {
	TaskId string `json:"taskId"`
}

// CancelTaskResult returns the cancelled task state.
type CancelTaskResult struct {
	Result
	Task
}

// TaskStatusNotification is sent when a task's status changes.
type TaskStatusNotification struct {
	Notification
	Params TaskStatusNotificationParams `json:"params"`
}

type TaskStatusNotificationParams struct {
	Task
}

// ClientRequest represents any request that can be sent from client to server.
type ClientRequest any

// ClientNotification represents any notification that can be sent from client to server.
type ClientNotification any

// ClientResult represents any result that can be sent from client to server.
type ClientResult any

// ServerRequest represents any request that can be sent from server to client.
type ServerRequest any

// ServerNotification represents any notification that can be sent from server to client.
type ServerNotification any

// ServerResult represents any result that can be sent from server to client.
type ServerResult any

type Named interface {
	GetName() string
}

// MarshalContent marshals MCP content as JSON.
func MarshalContent(content Content) ([]byte, error) {
	return json.Marshal(content)
}

// UnmarshalContent implements custom JSON unmarshaling for Content interface
func UnmarshalContent(data []byte) (Content, error) {
	var raw struct {
		Type any `json:"type"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	contentType, ok := raw.Type.(string)
	if !ok {
		return nil, fmt.Errorf("missing or invalid type field")
	}

	switch contentType {
	case ContentTypeText:
		var content TextContent
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeImage:
		var content ImageContent
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeAudio:
		var content AudioContent
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeLink:
		var content ResourceLink
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeResource:
		var content EmbeddedResource
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeToolUse:
		var content ToolUseContent
		err := json.Unmarshal(data, &content)
		return content, err
	case ContentTypeToolResult:
		var content ToolResultContent
		err := json.Unmarshal(data, &content)
		return content, err
	default:
		return nil, fmt.Errorf("unknown content type: %s", contentType)
	}
}

// ElicitationCapability represents the elicitation capabilities of a client or server.
type ElicitationCapability struct {
	Form *struct{} `json:"form,omitempty"` // Supports form mode
	URL  *struct{} `json:"url,omitempty"`  // Supports URL mode
}

// SamplingCapability represents the sampling capabilities of a client or server
// as defined by the 2025-11-25 protocol revision.
//
// A nil pointer means the peer does not support sampling at all. A non-nil but
// empty value (the zero value) advertises baseline sampling support without the
// optional context-inclusion or tool-use extensions.
type SamplingCapability struct {
	// Context, if non-nil, advertises that the client honours the
	// CreateMessageParams.IncludeContext field. If a peer does not declare this
	// sub-capability, servers SHOULD only use IncludeContext "none" or omit it.
	Context *struct{} `json:"context,omitempty"`
	// Tools, if non-nil, advertises that the client honours the
	// CreateMessageParams.Tools and CreateMessageParams.ToolChoice fields
	// (sampling with tools). Servers MUST NOT send those fields unless this
	// sub-capability is declared.
	Tools *struct{} `json:"tools,omitempty"`
}

// NewElicitationCompleteNotification creates a new elicitation complete notification.
func NewElicitationCompleteNotification(elicitationID string) JSONRPCNotification {
	return JSONRPCNotification{
		JSONRPC: JSONRPC_VERSION,
		Notification: Notification{
			Method: string(MethodNotificationElicitationComplete),
			Params: NotificationParams{
				AdditionalFields: map[string]any{
					"elicitationId": elicitationID,
				},
			},
		},
	}
}
