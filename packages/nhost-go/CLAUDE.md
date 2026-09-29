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

- Own module: `github.com/nhost/nhost/packages/nhost-go` has its own `go.mod`
  so `go get` fetches only this directory (the root module is too large for
  the module proxy's zip limit). Its `go` directive tracks the root module's;
  bump both together. Tags for it take the form `packages/nhost-go/vX.Y.Z`.
- Pure stdlib: the SDK has no external module dependencies, so it has no
  `go.sum` and no `vendor/`.
- Constructors are `New*` (`nhost.New`, `NewServerClient`, `NewBareClient`,
  `<svc>.NewClient`), not `Create*`.
- Methods are `context.Context`-first. REST and Functions calls return
  `(value, *transport.Response, error)`; GraphQL `Request` decodes into a typed
  destination and returns `(*transport.Response, error)`, while generic
  `graphql.Execute[T]` retains the three-value form.
- Request middleware is an `http.RoundTripper` decorator (`transport.Middleware`)
  installed on each service's `http.Client.Transport` via `transport.NewHTTPClient`.
  There is no post-construction `PushChainFunction`; `nhost.build` collects
  middleware into a `Config` first, then constructs the clients.
- Credential middleware is scoped to the service URL supplied to its
  constructor. A malformed service URL fails the request instead of silently
  disabling origin checks. Scheme-less custom URLs normalize to HTTP for
  localhost/loopback addresses and HTTPS otherwise. `transport.NewHTTPClient`
  also strips `Authorization` and `x-hasura-admin-secret` before cross-host
  redirects. Both layers are needed: Go copies nonstandard headers to the
  redirected request before invoking its `RoundTripper` again.
- Admin sessions are attached only over HTTPS or to loopback services unless
  `AdminSessionOptions.AllowInsecureHTTP` explicitly permits cleartext on a
  trusted development network. They are installed only on data services.
- Session capture is installed only on the auth client via `Config.UseAuth`. It
  matches the four singleton endpoints (`/signout`, `/user/password`, `/token`,
  `/token/exchange`) exactly, and `/signin/` and `/signup/` by prefix because
  those have per-method suffixes such as `/signin/email-password` -- do not
  "tighten" those two into exact matches. Refresh uses the bare `RefreshClient`,
  collapses concurrent refreshes into a single flight, and guards reentrancy by
  storage identity.
- Generated files carry `// Code generated ... DO NOT EDIT.` so golangci-lint
  auto-skips them; the plugin still applies Go initialisms (ID/URL/JSON) for
  nice field names.
- Response-reading middleware (`UpdateSessionFromResponse`) restores `resp.Body`
  after reading so downstream decoding still works.
- Nothing in the root module imports the SDK. The in-repo users, the
  cat-uploader demo and the notes tutorial, are modules of their own whose
  `go.mod` replaces the SDK with this directory, so an SDK change needs no
  `go mod vendor` anywhere. Only `gen.sh`'s `go run tools/codegen` fallback
  uses `GOFLAGS=-mod=mod` to execute the generator.

## Example and tutorial relationship

The notes CLI example is a superset of the Go tutorial: it includes repository
lint scaffolding and commands that the tutorial does not teach. The tutorial's
final program is deliberately smaller and contains no lint pragmas. Keep the two
behaviorally compatible for every command documented by the tutorial, but never
paste the example into the tutorial to make them identical; doing so introduces
unsupported commands and can break the tutorial's own command transcripts.

## Tests

- Offline: `go test ./...` (httptest-based unit tests per package).
- Integration: build-tagged `//go:build integration`, gated on
  `NHOST_LOCAL_BACKEND=1`; hits the local backend (signup, graphql `__typename`,
  functions `/echo`). Run: `make dev-env-up && make integration-local`.
- Go honors `SSL_CERT_FILE`, so a self-signed local backend cert can be trusted
  via `SSL_CERT_FILE=<bundle>` when running integration tests locally.
- Refresh fixtures must be seeded through `Storage.Set` with a decodable JWT.
  `needsRefresh` reads `StoredSession.DecodedToken.Exp`, not the raw access
  token; a hand-built `StoredSession` leaves `Exp == 0` and is already expired.
  `Storage.Set` rejects undecodable tokens with `invalid access token format`,
  and an expired session still makes refresh return an error even after a 200
  response if storing that response fails.
