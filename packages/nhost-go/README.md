# @nhost/nhost-go

The Nhost Go SDK: a small, idiomatic client for Nhost's Auth, Storage, GraphQL,
and Functions services. It mirrors the architecture of
[`@nhost/nhost-js`](../nhost-js) and the Python SDK: the auth and storage REST
clients are generated from the shared OpenAPI specs, while the fetch middleware
chain, session handling, GraphQL, and Functions clients are hand-written.

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
	client := nhost.CreateClient(nhost.Options{
		Subdomain: "local",
		Region:    "local",
	})

	ctx := context.Background()

	if _, err := client.Auth.SignInEmailPassword(ctx, auth.SignInEmailPasswordRequest{
		Email:    "user@example.com",
		Password: "secret",
	}, nil); err != nil {
		panic(err)
	}

	// The session was captured by middleware; the access token is attached and
	// refreshed automatically on subsequent requests.
	resp, err := client.GraphQL.Request(ctx, "query { __typename }", nil, "", nil)
	if err != nil {
		panic(err)
	}

	fmt.Println(resp.Body.Data["__typename"])
}
```

## Layout

| Package      | Contents                                                    |
| ------------ | ----------------------------------------------------------- |
| `.` (nhost)  | `Client`, `CreateClient`/`CreateServerClient`, service URLs |
| `auth`       | generated auth REST client + hand-written PKCE helpers      |
| `storage`    | generated storage REST client                               |
| `graphql`    | GraphQL client                                              |
| `functions`  | serverless Functions client                                 |
| `session`    | `StoredSession`, JWT decoding, storage backends, refresh    |
| `fetch`      | fetch pipeline (`FetchFunc`, `ChainFunction`, `FetchError`) |
| `middleware` | session refresh, token attachment, role/header/admin        |

## Development

```sh
./gen.sh                              # regenerate auth/storage clients
make test-local                       # offline unit tests
make dev-env-up                       # start a local backend
make integration-local                # run integration tests against it
```

Client selection:

- `CreateClient` — app client with automatic refresh + token attachment.
- `CreateServerClient` — trusted server contexts; requires explicit per-request
  `Storage` to avoid leaking sessions across users.
- `CreateNhostClient` — a bare client you configure yourself.
