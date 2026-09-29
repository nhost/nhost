---
title: Functions
---

Package functions invokes Nhost serverless functions through the shared HTTP
middleware installed on the client's Transport.

## Types

### `Client`

```go
type Client struct {
	BaseURL string
	// contains filtered or unexported fields
}
```

Client is a Functions API client backed by an *http.Client.

#### `NewClient`

```go
func NewClient(baseURL string, httpClient *http.Client) *Client
```

NewClient creates a new Functions client. A nil httpClient uses a default
*http.Client; supply one whose Transport carries the desired middleware.

#### `Call`

```go
func (c *Client) Call(
	ctx context.Context,
	path string,
	method string,
	headers http.Header,
	body io.Reader,
) (any, *transport.Response, error)
```

Call invokes a function with an arbitrary method and raw body. It returns the
decoded body (JSON -&gt; parsed value, text/* -&gt; string, otherwise []byte), the
HTTP response metadata, and a *transport.APIError on a non-2xx/3xx response.

#### `Post`

```go
func (c *Client) Post(
	ctx context.Context,
	path string,
	body any,
	headers http.Header,
) (any, *transport.Response, error)
```

Post is a convenience POST with a JSON body and JSON Accept/Content-Type.

