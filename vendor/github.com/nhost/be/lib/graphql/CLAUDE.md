> Repo-wide standards are in the root [CLAUDE.md](../../CLAUDE.md). Do not repeat repo-wide info here.

Shared Go library providing reusable GraphQL handlers, authorization directives, middleware, and custom scalar types for gqlgen-based services. Built on the gin web framework.

## Package Structure

- `graphql.go` -- Defines the `Directive` type alias for gqlgen directives.
- `context/` -- Helpers for storing/retrieving gin context, HTTP headers, and logrus loggers via `context.Context`. Handles both HTTP and WebSocket init payloads.
- `directive/` -- Authorization directives for gqlgen schemas:
  - `is_admin.go` -- `@isAdmin`: checks `X-Hasura-Admin-Secret` or `X-Hasura-Role` + `X-Nhost-Webhook-Secret`.
  - `has_role.go` -- `@hasRole`: checks if session variable role is in an allowed list.
  - `has_app_visibility.go` -- `@hasAppVisibility`: verifies user can access an app by querying nhost GraphQL. Has a bypass variant.
  - `member.go` -- `@member`: checks organization/app membership and role via DB queries (uses `DB` interface with sqlc-generated queries).
- `directive/sql/` -- sqlc-generated database queries for permission checks (`GetMemberRoleForOrganization`, `GetMemberRoleForApp`). Schema comes from `services/console-next/schema.sql`.
- `directive/mock/` -- mockgen-generated mocks for `DB` and `NhostAuthorizer` interfaces.
- `middleware/` -- Gin middleware:
  - `session_variables.go` -- Extracts session variables from admin secret, webhook secret, or JWT (Hasura claims format). Core auth middleware.
  - `logger.go` -- Attaches a logrus logger with trace ID to context.
  - `tracing.go` -- Extracts tracing info from HTTP headers into context.
  - `accounting.go` -- Logs GraphQL query and session info for auditing.
  - `prometheus.go` -- gqlgen field middleware for request metrics (counters, histograms).
- `handler/` -- Gin handler wrappers: GraphQL endpoint, healthz, playground, version.
- `types/` -- Custom gqlgen scalar marshaling for `uuid.UUID` and `map[string]string`.

## Testing

```bash
# Run all unit tests (from this directory)
make check

# Or directly with go test
go test ./...

# Run a specific test
go test ./directive/ -run TestMemberPermissions
go test ./middleware/ -run TestSessionVariables
```

The `has_app_visibility_test.go` is an integration test that hits `https://local.graphql.nhost.run/v1`. It requires the dev environment:

```bash
make dev-env-up    # starts console-next (local graphql)
make dev-env-down  # stops it
```

`make check` runs via Nix (`nix build ...#checks.<arch>-<os>.graphql`).

## Code Generation

- **sqlc**: `directive/sql/` contains generated code. Run `go generate ./directive/sql/` (or `sqlc generate` in that directory) to regenerate from `query.sql` + the console-next schema.
- **mockgen**: Mocks in `directive/mock/` are generated via `go:generate` directives in `has_app_visibility.go` (`NhostAuthorizer`) and `member.go` (`DB`). Run `go generate ./directive/`.

## Key Patterns

- **Session variables flow**: Middleware (`SessionVariablesReader`) extracts auth info from headers into `SessionVariables` struct, stores it in context. Directives then read it via `SessionVariablesFromCtx(ctx)`.
- **Three auth methods**: Admin secret (`X-Hasura-Admin-Secret`), webhook secret (`X-Nhost-Webhook-Secret` + `X-Hasura-Role`/`X-Hasura-User-Id`), or JWT bearer token (parsed with Hasura claims namespace).
- **Admin bypass**: The `member.go` directive short-circuits if `sessionVariables.Role == "admin"`, skipping DB permission checks.
- **Gin context bridging**: `GinContextToContextMiddleware` stores gin context in the standard `context.Context` so gqlgen resolvers can access HTTP request details.
- **Error types**: `directive/errors.go` defines an `Error` struct with error codes. Tests use `errors.Is` for comparison.
- **Tests use table-driven style** with `t.Parallel()` and gomock for DB interface mocking.
