# nhost-go — agent notes

Idiomatic Go SDK for Nhost, mirroring `@nhost/nhost-js` and the Python SDK.

## Two parts

1. **Generated** (`auth/client.go`, `storage/client.go`) — produced by the `go`
   plugin in `tools/codegen` from the shared OpenAPI specs. **Never hand-edit.**
   Regenerate with `./gen.sh` (uses the `codegen` binary or `go run`, then
   `goimports -w` to prune the superset import block deterministically).
2. **Hand-written runtime** — `fetch`, `middleware`, `session`, `graphql`,
   `functions`, and the top-level `nhost` package (`nhost.go`), plus `auth/pkce.go`.

## Import graph (no cycles)

`fetch` (pure, stdlib only) ← generated `auth`/`storage`; `session` → `auth`;
`middleware` → {`fetch`, `auth`, `session`}; top-level `nhost` → everything.
The generated clients depend only on `fetch`, so the auth↔fetch cycle that the
Python SDK broke with lazy imports simply does not arise here.

## Conventions

- Pure stdlib: no external module dependencies (no `go.sum`).
- Async is just `context.Context`-first methods returning `(*fetch.FetchResponse[T], error)`.
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
