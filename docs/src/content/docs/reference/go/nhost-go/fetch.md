---
title: Fetch
---

Package fetch provides the HTTP pipeline shared by the generated and
hand-written Nhost clients.

The pipeline mirrors @nhost/nhost-js's fetch module: a chain of middleware
functions wraps a base fetch backed by an *http.Client. Each middleware can
inspect/modify the outgoing *http.Request and the returned *http.Response,
which is how session refresh, access-token attachment, and role/header
injection are implemented.

## Functions

### `DecodeJSON`

```go
func DecodeJSON(response *http.Response, v any) error
```

DecodeJSON reads response and unmarshals its body into v. It is a no-op for
no-content statuses and empty bodies, leaving v at its zero value.

### `extractMessage`

```go
func extractMessage(body any) string
```

extractMessage is a best-effort extraction of a human-readable message from
an error body.

## Types

### `ChainFunction`

```go
type ChainFunction func(next FetchFunc) FetchFunc
```

ChainFunction takes the next fetch in the chain and returns a wrapping fetch.

### `FetchError`

```go
type FetchError struct {
	Body    any
	Status  int
	Headers http.Header
	message string
}
```

FetchError is returned when a request completes with a non-2xx/3xx status.
It carries the parsed response Body, Status code, and Headers.

#### `NewFetchError`

```go
func NewFetchError(body any, status int, headers http.Header) *FetchError
```

NewFetchError builds a FetchError, extracting a human-readable message from
common Nhost error response shapes.

#### `NewFetchErrorFromResponse`

```go
func NewFetchErrorFromResponse(response *http.Response) *FetchError
```

NewFetchErrorFromResponse builds a FetchError from an error response.

#### `Error`

```go
func (e *FetchError) Error() string
```

### `FetchFunc`

```go
type FetchFunc func(req *http.Request) (*http.Response, error) //nolint:revive // cross-SDK name parity
```

FetchFunc takes a prepared request and returns a response. The name mirrors
the equivalent type across the Nhost SDKs (nhost-js / nhost-python).

#### `CreateEnhancedFetch`

```go
func CreateEnhancedFetch(client *http.Client, chainFunctions []ChainFunction) FetchFunc
```

CreateEnhancedFetch composes chainFunctions around a base fetch backed by
client. The chain executes in slice order: the first middleware wraps the
second, and so on, with the base fetch (client.Do) at the center. This
matches the reduceRight composition used by the JS SDK.

### `FetchResponse`

```go
type FetchResponse[T any] struct {
	Body    T
	Status  int
	Headers http.Header
}
```

FetchResponse is a structured API response: the parsed body plus status and
headers.

