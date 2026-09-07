---
title: Graphql
---

Package graphql executes GraphQL operations against a Hasura GraphQL endpoint
through the shared HTTP middleware installed on the client's Transport.

## Functions

### `Execute`

```go
func Execute[T any](
	ctx context.Context,
	client *Client,
	query string,
	variables any,
	opts ...RequestOption,
) (T, *transport.Response, error)
```

Execute runs a GraphQL operation and returns its data decoded into T. It is a
generic convenience over Client.Request; use Client.Request directly when a
destination-style API is preferable.

## Types

### `Client`

```go
type Client struct {
	URL string
	// contains filtered or unexported fields
}
```

Client is a GraphQL API client backed by an *http.Client.

#### `NewClient`

```go
func NewClient(url string, httpClient *http.Client) *Client
```

NewClient creates a new GraphQL client. A nil httpClient uses a default
*http.Client; supply one whose Transport carries the desired middleware.

#### `Request`

```go
func (c *Client) Request(
	ctx context.Context,
	query string,
	variables any,
	destination any,
	opts ...RequestOption,
) (*transport.Response, error)
```

Request executes a GraphQL operation and decodes its data into destination,
which should be a pointer to the expected response type. A nil destination
discards response data. Variables may be either a typed struct or Variables.

GraphQL errors are returned as *ResponseError. If a response contains both
data and errors, Request decodes the partial data before returning the error.
Non-success HTTP responses without GraphQL errors are returned as
*transport.APIError, and successful responses that cannot be decoded are
returned as *DecodeError.

### `DecodeError`

```go
type DecodeError struct {
	// contains filtered or unexported fields
}
```

DecodeError reports a failure to decode a successful GraphQL response or its
data into the requested destination type.

#### `Error`

```go
func (e *DecodeError) Error() string
```

Error implements the error interface.

#### `Unwrap`

```go
func (e *DecodeError) Unwrap() error
```

Unwrap returns the underlying JSON decoding error.

### `Error`

```go
type Error struct {
	Message    string          `json:"message"`
	Locations  []ErrorLocation `json:"locations,omitempty"`
	Path       []any           `json:"path,omitempty"`
	Extensions map[string]any  `json:"extensions,omitempty"`
}
```

Error is a single GraphQL error entry as defined by the GraphQL spec.

### `ErrorLocation`

```go
type ErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}
```

ErrorLocation is the line/column of a GraphQL error.

### `RequestOption`

```go
type RequestOption func(*requestOptions)
```

RequestOption configures a GraphQL request.

#### `WithHeaders`

```go
func WithHeaders(headers http.Header) RequestOption
```

WithHeaders adds HTTP headers to a GraphQL request.

#### `WithOperationName`

```go
func WithOperationName(operationName string) RequestOption
```

WithOperationName sets the GraphQL operationName request field.

### `ResponseError`

```go
type ResponseError struct {
	Errors  []Error
	Data    json.RawMessage
	Status  int
	Headers http.Header
	// contains filtered or unexported fields
}
```

ResponseError reports errors returned in a GraphQL response. Data contains
any partial response data supplied alongside the errors. Request and Execute
attempt to decode that partial data into the caller's destination before
returning this error.

#### `Error`

```go
func (e *ResponseError) Error() string
```

Error implements the error interface.

#### `Unwrap`

```go
func (e *ResponseError) Unwrap() error
```

Unwrap returns an error encountered while decoding partial response data, if
any.

### `Variables`

```go
type Variables map[string]any
```

Variables is a GraphQL variables map. Request and Execute also accept typed
structs when callers want compile-time types for their variables.

