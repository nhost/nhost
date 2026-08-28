---
title: Graphql
---

Package graphql executes GraphQL operations against a Hasura GraphQL endpoint
through the shared fetch middleware chain.

## Functions

### `Execute`

```go
func Execute[T any](
	ctx context.Context,
	c *Client,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*fetch.FetchResponse[Response[T]], error)
```

Execute runs a GraphQL operation and decodes the data field into T.

It returns a *fetch.FetchError when either (a) the response body carries a
top-level GraphQL `errors` array, or (b) the transport returns a non-2xx/3xx
HTTP status (e.g. auth/gateway failures whose body has no `errors` key).
GraphQL-level errors take precedence over the HTTP status.

Note: when a GraphQL `errors` array is present the typed data is dropped and
only the raw response survives in FetchError.Body. Callers needing partial
data (data + errors, as Hasura may return for remote-schema/action failures)
must read FetchError.Body.

## Types

### `Client`

```go
type Client struct {
	URL            string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}
```

Client is a GraphQL API client backed by an *http.Client and a middleware
chain.

#### `NewClient`

```go
func NewClient(url string, chainFunctions []fetch.ChainFunction, httpClient *http.Client) *Client
```

NewClient creates a new GraphQL client.

#### `PushChainFunction`

```go
func (c *Client) PushChainFunction(cf fetch.ChainFunction)
```

PushChainFunction appends a middleware chain function and rebuilds the pipeline.

#### `Request`

```go
func (c *Client) Request(
	ctx context.Context,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*fetch.FetchResponse[Response[map[string]any]], error)
```

Request executes a GraphQL operation, decoding data into a generic map. It
returns a *fetch.FetchError if the response contains GraphQL errors.

#### `do`

```go
func (c *Client) do(
	ctx context.Context,
	query string,
	variables Variables,
	operationName string,
	headers http.Header,
) (*http.Response, []byte, error)
```

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

### `Response`

```go
type Response[T any] struct {
	Data   T       `json:"data"`
	Errors []Error `json:"errors,omitempty"`
}
```

Response is the standard GraphQL response envelope, generic over the shape of
the data field.

### `Variables`

```go
type Variables map[string]any
```

Variables is a GraphQL variables map.

