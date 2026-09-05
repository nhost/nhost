---
title: Transport
---

Package transport provides the HTTP middleware shared by the generated and
hand-written Nhost clients, along with the service-URL helpers
([IsLoopbackHost], [NormalizeServiceURL]) that decide whether a credential
may travel in cleartext. Those helpers live here so the nhost and middleware
packages share one implementation of that rule rather than each carrying a
copy that can drift.

Middleware is modelled as an [http.RoundTripper] decorator: each Middleware
wraps the next RoundTripper in the chain and may inspect or modify the
outgoing *http.Request and the returned *http.Response. Session refresh,
access-token attachment, and role/header injection are all implemented this
way. The composed RoundTripper is installed as an [http.Client.Transport],
so the service clients issue requests with the standard [http.Client.Do].

## Functions

### `Chain`

```go
func Chain(base http.RoundTripper, middleware ...Middleware) http.RoundTripper
```

Chain composes middleware around base. The middleware execute in argument
order: the first wraps the second, and so on, with base at the centre. A nil
base defaults to [http.DefaultTransport].

### `DecodeJSON`

```go
func DecodeJSON(response *http.Response, v any) error
```

DecodeJSON reads response and unmarshals its body into v. It is a no-op for
no-content statuses and empty bodies, leaving v at its zero value.

### `IsLoopbackHost`

```go
func IsLoopbackHost(hostname string) bool
```

IsLoopbackHost reports whether hostname identifies localhost or a loopback
IP address.

### `NewHTTPClient`

```go
func NewHTTPClient(base *http.Client, middleware ...Middleware) *http.Client
```

NewHTTPClient returns a copy of base whose Transport applies middleware. base
may be nil, in which case a zero-value client (using
[http.DefaultTransport]) is wrapped. The original base is never mutated, so
callers may share one *http.Client across services with distinct middleware.
Sensitive Nhost credentials are stripped before following a redirect to a
different host; redirects otherwise retain the base client's behavior.

### `NormalizeServiceURL`

```go
func NormalizeServiceURL(serviceURL string) string
```

NormalizeServiceURL adds a scheme to a scheme-less service URL, choosing
HTTP for loopback hosts and HTTPS otherwise. URLs that already have a scheme,
or cannot be parsed as an authority, are returned unchanged.

## Types

### `APIError`

```go
type APIError struct {
	Body    any
	Status  int
	Headers http.Header
	// contains filtered or unexported fields
}
```

APIError is returned when a request completes with a non-2xx/3xx status. It
carries the parsed response Body, Status code, and Headers.

#### `NewAPIError`

```go
func NewAPIError(body any, status int, headers http.Header) *APIError
```

NewAPIError builds an APIError, extracting a human-readable message from
common Nhost error response shapes.

#### `NewAPIErrorFromResponse`

```go
func NewAPIErrorFromResponse(response *http.Response) *APIError
```

NewAPIErrorFromResponse builds an APIError from an error response.

#### `Error`

```go
func (e *APIError) Error() string
```

Error implements the error interface.

### `Middleware`

```go
type Middleware func(next http.RoundTripper) http.RoundTripper
```

Middleware wraps a RoundTripper with additional behaviour, returning a
RoundTripper that typically calls through to next.

### `Response`

```go
type Response struct {
	Status  int
	Headers http.Header
}
```

Response carries the HTTP metadata returned alongside a decoded body.

### `RoundTripFunc`

```go
type RoundTripFunc func(req *http.Request) (*http.Response, error)
```

RoundTripFunc adapts an ordinary function to an [http.RoundTripper].

#### `RoundTrip`

```go
func (f RoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error)
```

RoundTrip implements [http.RoundTripper].

