# nhost-go — agent notes

Idiomatic Go SDK for Nhost.

## Two parts

1. **Generated** (`auth/client.go`, `storage/client.go`) — produced by the `go`
   plugin in `tools/codegen` from the shared OpenAPI specs. **Never hand-edit.**
   Regenerate with `./gen.sh` (uses the `codegen` binary or `go run`; the
   generator prunes imports and formats the output deterministically).
2. **Hand-written runtime** — `transport`, `middleware`, `session`, `graphql`,
   `functions`, and the top-level `nhost` package (`nhost.go`), plus `auth/pkce.go`.

## Import graph (no cycles)

`transport` (pure, stdlib only) ← generated `auth`/`storage`; `session` →
{`auth`, `transport`}; `middleware` → {`transport`, `auth`, `session`}; top-level
`nhost` → everything. The generated clients depend only on `transport`, so no
import cycle arises.

## Conventions

- Pure stdlib: no external module dependencies (no `go.sum`).
- Constructors are `New*` (`nhost.New`, `NewServerClient`, `NewBareClient`,
  `<svc>.NewClient`), not `Create*`.
- Methods are `context.Context`-first and return `(value, *transport.Response, error)`.
- Request middleware is an `http.RoundTripper` decorator (`transport.Middleware`)
  installed on each service's `http.Client.Transport` via `transport.NewHTTPClient`.
  There is no post-construction `PushChainFunction`; `nhost.build` collects
  middleware into a `Config` first, then constructs the clients.
- Credential middleware is scoped to its configured service origin, and
  `transport.NewHTTPClient` also strips `Authorization` and
  `x-hasura-admin-secret` before cross-host redirects. Both layers are needed:
  Go copies nonstandard headers to the redirected request before invoking its
  `RoundTripper` again.
- Generated files carry `// Code generated ... DO NOT EDIT.` so golangci-lint
  auto-skips them; the plugin still applies Go initialisms (ID/URL/JSON) for
  nice field names.
- Response-reading middleware (`UpdateSessionFromResponse`) restores `resp.Body`
  after reading so downstream decoding still works.
- `GOFLAGS=-mod=mod` for local builds; the module targets `go 1.23`.

## Tests

- Offline: `go test ./...` (httptest-based unit tests per package).
- Integration: build-tagged `//go:build integration`, gated on
  `NHOST_LOCAL_BACKEND=1`; hits the local backend (signup, graphql `__typename`,
  functions `/echo`). Run: `make dev-env-up && make integration-local`.
- Go honors `SSL_CERT_FILE`, so a self-signed local backend cert can be trusted
  via `SSL_CERT_FILE=<bundle>` when running integration tests locally.
