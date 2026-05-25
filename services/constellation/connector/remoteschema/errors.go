package remoteschema

import "errors"

// ErrUnsupportedURLScheme is returned when a remote schema URL uses a scheme
// other than http or https.
var ErrUnsupportedURLScheme = errors.New("unsupported URL scheme")

// ErrURLMissingHost is returned when a remote schema URL has no host component.
var ErrURLMissingHost = errors.New("URL has no host")

// ErrRemoteStatus is returned when the remote schema endpoint responds with a
// non-200 HTTP status.
var ErrRemoteStatus = errors.New("remote schema returned status")

// ErrIntrospectionResponse is returned when the remote schema's introspection
// response contains a non-empty top-level errors array.
var ErrIntrospectionResponse = errors.New("introspection returned errors")

// RemoteError is a single GraphQL error returned by a remote schema endpoint.
// The fields mirror the GraphQL-over-HTTP wire format and are populated by
// encoding/json/v2 when the remote endpoint responds with a `errors` array.
type RemoteError struct {
	Message    string                `json:"message"`
	Path       []any                 `json:"path,omitempty"`
	Locations  []RemoteErrorLocation `json:"locations,omitempty"`
	Extensions map[string]any        `json:"extensions,omitempty"`
}

// RemoteErrorLocation is a source location in a remote GraphQL error.
type RemoteErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// AsMap renders the error in the standard GraphQL error response shape
// (a map with optional "path", "locations", and "extensions" keys).
func (e RemoteError) AsMap() map[string]any {
	m := map[string]any{"message": e.Message}

	if len(e.Path) > 0 {
		m["path"] = e.Path
	}

	if len(e.Locations) > 0 {
		m["locations"] = e.Locations
	}

	if len(e.Extensions) > 0 {
		m["extensions"] = e.Extensions
	}

	return m
}

// GraphQLError wraps structured GraphQL errors returned by a remote schema so
// they can be carried through the error interface without losing fields like
// path, locations, and extensions. It is returned by Connector.Execute when
// the remote endpoint responds 200 OK with a non-empty top-level `errors`
// array. The Errors field is treated as immutable by the consumer
// (controller/resolve.go) and producers should use NewGraphQLError to
// construct values.
type GraphQLError struct {
	Errors []RemoteError
}

// NewGraphQLError constructs a GraphQLError carrying the given remote errors.
func NewGraphQLError(errs []RemoteError) *GraphQLError {
	return &GraphQLError{Errors: errs}
}

// Error renders the first remote error's message. If the wrapper carries no
// errors the rendering is "graphql errors".
func (e *GraphQLError) Error() string {
	if len(e.Errors) == 0 {
		return "graphql errors"
	}

	return "graphql error: " + e.Errors[0].Message
}
