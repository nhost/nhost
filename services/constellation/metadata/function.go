package metadata

// FunctionMetadata represents metadata for a tracked database function.
type FunctionMetadata struct {
	Function      FunctionSource        `json:"function"               toml:"function"`
	Configuration FunctionConfiguration `json:"configuration,omitzero" toml:"configuration,omitempty"`
	Permissions   []FunctionPermission  `json:"permissions,omitempty"  toml:"permissions,omitempty"`
}

// FunctionPermission represents a role's permission to execute a function.
type FunctionPermission struct {
	Role string `json:"role" toml:"role"`
}

// FunctionSource identifies the function in the database.
type FunctionSource struct {
	Name   string `json:"name"   toml:"name"`
	Schema string `json:"schema" toml:"schema"`
}

// FunctionConfiguration allows customizing the function's GraphQL representation.
type FunctionConfiguration struct {
	// CustomName overrides the GraphQL field name derived from the SQL
	// function's name.
	CustomName string `json:"custom_name,omitempty" toml:"custom_name,omitempty"`
	// CustomRootFields overrides the default names of the root fields
	// (function and function_aggregate) generated for this function.
	CustomRootFields FunctionCustomRootFields `json:"custom_root_fields,omitzero" toml:"custom_root_fields,omitempty"` //nolint:lll
	// ExposedAs selects how the function appears in the GraphQL schema:
	// "query" or "mutation".
	ExposedAs string `json:"exposed_as,omitempty" toml:"exposed_as,omitempty"`
	// SessionArgument names the function parameter that receives the
	// session-variable JSON object on every invocation. Empty disables
	// session-variable injection.
	SessionArgument string `json:"session_argument,omitempty" toml:"session_argument,omitempty"`
}

// FunctionCustomRootFields allows overriding the default GraphQL field names for functions.
type FunctionCustomRootFields struct {
	Function          string `json:"function,omitempty"           toml:"function,omitempty"`
	FunctionAggregate string `json:"function_aggregate,omitempty" toml:"function_aggregate,omitempty"`
}
