# @nhost/nhost-go

The Nhost Go SDK: a small, idiomatic client for Nhost's Auth, Storage, GraphQL,
and Functions services. The auth and storage REST clients are generated from the
shared OpenAPI specs; the HTTP middleware, session handling, GraphQL, and
Functions clients are hand-written.

It follows Go conventions: constructors are `New*`, request middleware is an
[`http.RoundTripper`](https://pkg.go.dev/net/http#RoundTripper) installed on the
client's `Transport`, and every call returns the decoded body, the HTTP response
metadata, and an error — `(value, *transport.Response, error)`.

## Install

```sh
go get github.com/nhost/nhost/packages/nhost-go
```

## Quickstart

```go
package main

import (
	"context"
	"fmt"

	nhost "github.com/nhost/nhost/packages/nhost-go"
	"github.com/nhost/nhost/packages/nhost-go/auth"
)

func main() {
	client := nhost.New(nhost.Options{
		Subdomain: "local",
		Region:    "local",
	})

	ctx := context.Background()

	if _, _, err := client.Auth.SignInEmailPassword(ctx, auth.SignInEmailPasswordRequest{
		Email:    "user@example.com",
		Password: "secret",
	}, nil); err != nil {
		panic(err)
	}

	// The session was captured by middleware; the access token is attached and
	// refreshed automatically on subsequent requests.
	res, _, err := client.GraphQL.Request(ctx, "query { __typename }", nil, "", nil)
	if err != nil {
		panic(err)
	}

	fmt.Println(res.Data["__typename"])
}
```

## Layout

| Package      | Contents                                                         |
| ------------ | ---------------------------------------------------------------- |
| `.` (nhost)  | `Client`, `New`/`NewServerClient`/`NewBareClient`, service URLs  |
| `auth`       | generated auth REST client + hand-written PKCE helpers           |
| `storage`    | generated storage REST client                                    |
| `graphql`    | GraphQL client                                                   |
| `functions`  | serverless Functions client                                      |
| `session`    | `StoredSession`, JWT decoding, storage backends, refresh         |
| `transport`  | HTTP middleware + service-URL helpers (`Middleware`, `Chain`, `Response`, `APIError`, `IsLoopbackHost`, `NormalizeServiceURL`) |
| `middleware` | session refresh, token attachment, role/header/admin             |

## Development

```sh
./gen.sh                              # regenerate auth/storage clients
make test-local                       # offline unit tests
make dev-env-up                       # start a local backend
make integration-local                # run integration tests against it
```

Client selection:

- `New` — app client with automatic refresh + token attachment.
- `NewServerClient` — trusted server contexts; requires explicit per-request
  `Storage` to avoid leaking sessions across users.
- `NewBareClient` — a bare client you configure yourself (no middleware beyond
  what `Options.Configure` supplies).
