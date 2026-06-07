package metadata

// Action operation type values used by Hasura action definitions.
const (
	// ActionOperationQuery exposes the action under the query root.
	ActionOperationQuery = "query"
	// ActionOperationMutation exposes the action under the mutation root.
	ActionOperationMutation = "mutation"
)

// Action execution kind values used by Hasura action definitions.
const (
	// ActionKindSynchronous executes the webhook during the GraphQL request.
	ActionKindSynchronous = "synchronous"
	// ActionKindAsynchronous enqueues the action and returns an action log UUID.
	ActionKindAsynchronous = "asynchronous"
)

// ActionMetadata describes one Hasura Action after conversion into
// Constellation's native metadata model.
type ActionMetadata struct {
	Name        string             `json:"name"                  toml:"name"`
	Definition  ActionDefinition   `json:"definition"            toml:"definition"`
	Permissions []ActionPermission `json:"permissions,omitempty" toml:"permissions,omitempty"`
	Comment     string             `json:"comment,omitempty"     toml:"comment,omitempty"`
}

// ActionDefinition captures the static configuration required to expose and
// execute an action. Runtime execution is added by later phases; Phase 2 only
// stores the parsed metadata and reports it as unsupported.
type ActionDefinition struct {
	Kind                 string           `json:"kind,omitempty"                   toml:"kind,omitempty"`
	Handler              EnvString        `json:"handler"                          toml:"handler"`
	ForwardClientHeaders bool             `json:"forward_client_headers,omitempty" toml:"forward_client_headers,omitempty"` //nolint:lll
	Headers              []ActionHeader   `json:"headers,omitempty"                toml:"headers,omitempty"`
	Timeout              int              `json:"timeout,omitempty"                toml:"timeout,omitempty"`
	Type                 string           `json:"type,omitempty"                   toml:"type,omitempty"`
	Arguments            []ActionArgument `json:"arguments,omitempty"              toml:"arguments,omitempty"`
	OutputType           string           `json:"output_type,omitempty"            toml:"output_type,omitempty"`
	RequestTransform     map[string]any   `json:"request_transform,omitempty"      toml:"request_transform,omitempty"`
	ResponseTransform    map[string]any   `json:"response_transform,omitempty"     toml:"response_transform,omitempty"`
}

// ActionArgument defines one GraphQL argument accepted by an action root field.
type ActionArgument struct {
	Name        string `json:"name"                  toml:"name"`
	Type        string `json:"type"                  toml:"type"`
	Description string `json:"description,omitempty" toml:"description,omitempty"`
}

// ActionHeader defines a static header Hasura attaches to an action webhook.
type ActionHeader struct {
	Name         string `json:"name"                     toml:"name"`
	Value        string `json:"value,omitempty"          toml:"value,omitempty"`
	ValueFromEnv string `json:"value_from_env,omitempty" toml:"value_from_env,omitempty"`
}

// ActionPermission grants a role access to an action. Admin access is implied
// by the global admin role and is not stored as an explicit permission.
type ActionPermission struct {
	Role string `json:"role" toml:"role"`
}
