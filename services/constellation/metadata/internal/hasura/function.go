package hasura

import (
	"context"
	"fmt"
)

// FunctionMetadata represents metadata for a tracked PostgreSQL function.
type FunctionMetadata struct {
	Function      FunctionSource        `json:"function"      yaml:"function"`
	Configuration FunctionConfiguration `json:"configuration" yaml:"configuration,omitempty"`
	// Permissions defines explicit permissions for volatile functions (mutations).
	// For stable/immutable functions, permissions are inherited from the base table.
	Permissions []FunctionPermission `json:"permissions,omitempty" yaml:"permissions,omitempty"`
}

// FunctionPermission represents a role's permission to execute a function.
type FunctionPermission struct {
	Role string `json:"role" yaml:"role"`
}

// UnmarshalYAML handles entries that may be `!include <path>` directives in
// addition to inline data. It uses the context-aware variant so the include
// base directory can be threaded through the decoder without package-level
// globals.
func (f *FunctionMetadata) UnmarshalYAML(ctx context.Context, unmarshal func(any) error) error {
	var includeStr string
	if err := unmarshal(&includeStr); err == nil {
		if path, ok := parseIncludePath(includeStr); ok {
			return loadIncludedFile(ctx, path, f)
		}
	}

	// functionAlias drops the custom UnmarshalYAML so the default decoder runs.
	type functionAlias FunctionMetadata

	var alias functionAlias
	if err := unmarshal(&alias); err != nil {
		return fmt.Errorf("unmarshaling function metadata: %w", err)
	}

	*f = FunctionMetadata(alias)

	return nil
}

// FunctionSource identifies the function in the database.
type FunctionSource struct {
	Name   string `json:"name"   yaml:"name"`
	Schema string `json:"schema" yaml:"schema"`
}

// FunctionConfiguration allows customizing the function's GraphQL representation.
type FunctionConfiguration struct {
	// CustomName overrides the base name used for generating GraphQL field names.
	// If set, this becomes the default for function field and aggregate field names.
	CustomName string `json:"custom_name,omitempty" yaml:"custom_name,omitempty"`
	// CustomRootFields allows overriding the default GraphQL field names
	CustomRootFields FunctionCustomRootFields `json:"custom_root_fields" yaml:"custom_root_fields,omitempty"`
	// ExposedAs controls whether function appears as query or mutation.
	// If not set, determined by volatility (STABLE/IMMUTABLE -> query, VOLATILE -> mutation)
	ExposedAs string `json:"exposed_as,omitempty" yaml:"exposed_as,omitempty"`
	// SessionArgument specifies a function argument that should receive session variables
	// as a JSON object. When set, this argument is hidden from the GraphQL schema and
	// automatically populated with the session variables at query execution time.
	SessionArgument string `json:"session_argument,omitempty" yaml:"session_argument,omitempty"`
}

// FunctionCustomRootFields allows overriding the default GraphQL field names for functions.
type FunctionCustomRootFields struct {
	Function          string `json:"function,omitempty"           yaml:"function,omitempty"`
	FunctionAggregate string `json:"function_aggregate,omitempty" yaml:"function_aggregate,omitempty"`
}
