---
title: Functions
---

Package functions invokes Nhost serverless functions through the shared fetch
middleware chain.

## Functions

### `decodeBody`

```go
func decodeBody(response *http.Response, body []byte) any
```

## Types

### `Client`

```go
type Client struct {
	BaseURL        string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}
```

Client is a Functions API client backed by an *http.Client and a middleware
chain.

#### `NewClient`

```go
func NewClient(baseURL string, chainFunctions []fetch.ChainFunction, httpClient *http.Client) *Client
```

NewClient creates a new Functions client.

#### `Fetch`

```go
func (c *Client) Fetch(
	ctx context.Context,
	path string,
	method string,
	headers http.Header,
	body io.Reader,
) (*fetch.FetchResponse[any], error)
```

Fetch invokes a function with an arbitrary method and raw body. The response
body is decoded by content type (JSON -&gt; parsed value, text/* -&gt; string,
otherwise []byte). It returns a *fetch.FetchError on a non-2xx/3xx response.

#### `Post`

```go
func (c *Client) Post(
	ctx context.Context,
	path string,
	body any,
	headers http.Header,
) (*fetch.FetchResponse[any], error)
```

Post is a convenience POST with a JSON body and JSON Accept/Content-Type.

#### `PushChainFunction`

```go
func (c *Client) PushChainFunction(cf fetch.ChainFunction)
```

PushChainFunction appends a middleware chain function and rebuilds the pipeline.

