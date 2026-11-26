package mcp

import "net/http"

// DiscoverRequest is sent by a client to learn a server's supported protocol
// versions, capabilities, and identity without performing the legacy
// initialize handshake (SEP-2575).
//
// Servers implementing protocol version 2026-07-28 or later MUST support this
// method. Clients MAY call it before any other request, or skip it entirely
// and handle [UnsupportedProtocolVersionError] inline.
type DiscoverRequest struct {
	Request
	Header http.Header    `json:"-"`
	Params DiscoverParams `json:"params,omitzero"`
}

// DiscoverParams are the parameters of a server/discover request. Like every
// modern request, the protocol version, client identity, and client
// capabilities travel in Meta.
type DiscoverParams struct {
	// Meta carries the per-request protocol metadata.
	Meta *Meta `json:"_meta,omitempty"`
}

// DiscoverResult is a server's response to a server/discover request.
type DiscoverResult struct {
	CacheableResult

	// SupportedVersions lists the MCP protocol versions this server supports,
	// newest first. The client should choose one for subsequent requests.
	SupportedVersions []string `json:"supportedVersions"`

	// Capabilities describes the server's capabilities.
	Capabilities ServerCapabilities `json:"capabilities"`

	// Instructions is natural-language guidance describing the server and its
	// features, for inclusion in an LLM system prompt.
	Instructions string `json:"instructions,omitempty"`
}

// SubscriptionFilter is the set of notification types a client opts in to on a
// subscriptions/listen request. Each type is opt-in: the server MUST NOT send
// notification types the client has not explicitly requested.
type SubscriptionFilter struct {
	// ToolsListChanged opts in to notifications/tools/list_changed.
	ToolsListChanged bool `json:"toolsListChanged,omitempty"`
	// PromptsListChanged opts in to notifications/prompts/list_changed.
	PromptsListChanged bool `json:"promptsListChanged,omitempty"`
	// ResourcesListChanged opts in to notifications/resources/list_changed.
	ResourcesListChanged bool `json:"resourcesListChanged,omitempty"`
	// ResourceSubscriptions opts in to notifications/resources/updated for the
	// listed resource URIs. It replaces the resources/subscribe RPC.
	ResourceSubscriptions []string `json:"resourceSubscriptions,omitempty"`
}

// IsEmpty reports whether the filter opts in to nothing.
func (f SubscriptionFilter) IsEmpty() bool {
	return !f.ToolsListChanged &&
		!f.PromptsListChanged &&
		!f.ResourcesListChanged &&
		len(f.ResourceSubscriptions) == 0
}

// SubscriptionsListenRequest opens a long-lived stream for receiving
// server-to-client notifications outside the context of a specific request
// (SEP-2575). It replaces the HTTP GET endpoint and the
// resources/subscribe and resources/unsubscribe RPCs.
type SubscriptionsListenRequest struct {
	Request
	Header http.Header               `json:"-"`
	Params SubscriptionsListenParams `json:"params"`
}

// SubscriptionsListenParams are the parameters of a subscriptions/listen
// request.
type SubscriptionsListenParams struct {
	// Notifications selects the notification types the client opts in to.
	Notifications SubscriptionFilter `json:"notifications"`
	// Meta carries the per-request protocol metadata.
	Meta *Meta `json:"_meta,omitempty"`
}

// SubscriptionsListenResult closes a subscriptions/listen stream. Its Meta
// carries [MetaKeySubscriptionID], identifying the stream being closed.
type SubscriptionsListenResult struct {
	Result
}

// SubscriptionsAcknowledgedNotification informs the client which of the
// requested subscriptions the server actually established. It is the first
// message delivered on a subscriptions/listen stream.
type SubscriptionsAcknowledgedNotification struct {
	Notification
	Params SubscriptionsAcknowledgedParams `json:"params"`
}

// SubscriptionsAcknowledgedParams are the parameters of a
// notifications/subscriptions/acknowledged notification.
type SubscriptionsAcknowledgedParams struct {
	// Notifications is the subset of the requested filter that the server
	// established, after intersecting it with the server's capabilities.
	Notifications SubscriptionFilter `json:"notifications"`
	// Meta carries [MetaKeySubscriptionID].
	Meta map[string]any `json:"_meta,omitempty"`
}
