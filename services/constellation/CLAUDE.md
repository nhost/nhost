# Project Overview

Constellation is a GraphQL backend server for Nhost that replaces Hasura. It introspects databases, generates role-based GraphQL schemas with permissions, and executes queries, mutations, and subscriptions. Supports PostgreSQL and SQLite as database backends, plus remote GraphQL schemas.

## Structure

- `vendor/` - Vendored Go dependencies (do not modify manually)
- `build/` - Docker Compose and dev environment configs
- `cmd/` - CLI commands: `serve` (main server), `debug` (schema inspection), `metadata` (metadata utilities)
- `connector/` - Data source abstraction layer. `Connector` interface for introspecting schemas and executing operations. `SchemaComposer` merges per-role schemas from all connectors
- `connector/sql/` - Shared SQL connector. `Driver` interface abstracts database-specific operations (introspect, execute, dialect). Subpackages:
  - `graphql/queries/` - SQL query builders. Translates GraphQL operations into parameterized SQL. `Dialect` interface abstracts PostgreSQL vs SQLite syntax. Largest package (~75 files). Golden file tests in `testdata/`
  - `graphql/schema/` - GraphQL schema generation from introspected objects. `Capabilities` struct gates features by database type. Golden file tests in `testdata/`
  - `postgres/` - PostgreSQL driver (pgx pool)
  - `sqlite/` - SQLite driver (go-sqlite3, requires CGO). WAL mode, foreign keys enforced
  - `introspection/` - Database introspection types (`Objects`, `Function`)
  - `subscription/` - Subscription polling with multiplexed queries and cohort management
- `connector/remoteschema/` - Remote GraphQL schema connector. Introspects remote endpoints, applies permissions, forwards operations
- `controller/` - HTTP request handling and GraphQL execution orchestration. Parses requests, selects role-specific schemas, plans queries across connectors, resolves remote relationships. Subpackages:
  - `planner/` - Analyzes GraphQL operations to detect remote relationships, determines phantom fields (join columns) to inject, transforms ASTs per connector (stripping relationship fields, filtering fragments)
  - `resolver/` - Executes cross-connector relationship queries after primary execution and stitches results back. Two strategies: `DatabaseResolver` (WHERE IN batching) and `SchemaResolver` (aliased field batching)
  - `middleware/` - Session extraction from HTTP requests. Three-tier auth: admin secret -> JWT -> public role fallback. `X-Hasura-*` headers become session variables
  - `websocket/` - `graphql-transport-ws` protocol handler. Pure protocol layer (read/write pumps, message routing, ping/pong). Business logic delegated to `MessageHandler` interface
- `graph/` - Intermediate GraphQL schema representation (`Schema`, `ObjectType`, `Field`, etc.) with `ToAST()` conversion to gqlparser types
- `metadata/` - Configuration parsing. Reads Hasura-compatible YAML or TOML metadata defining databases, tables, permissions, relationships, remote schemas, and functions
- `subscription/` - Subscription handler interface and types (`Request`, `Update`, `Handler`)
- `integration/` - Integration tests against real PostgreSQL and Nhost environments
- `internal/` - Internal utilities:
  - `jwt/` - JWT validation (HMAC/RSA, static keys, JWKS URLs). Multiple secrets with fallthrough. Extracts Hasura claims and builds session variables
  - `jsonpath/` - Dot-separated JSON path navigation with array flattening. Used by planner/resolver for phantom field injection and result manipulation
  - `requestcontext/` - Context value storage for HTTP headers and logger propagation through middleware chain
  - `lib/lru/` - Thread-safe generic LRU cache (used by controller query cache)
  - `lib/syncmap/` - Thread-safe generic map with RWMutex
  - `lib/oapi/{cors,logger,tracing}/` - Gin middleware split by concern: CORS, request logging (slog), B3 distributed tracing
  - `lib/testhelpers/` - Golden file testing helpers (JSON and GraphQL schema comparison)
- `docs/` - Developer documentation (query execution pipeline, remote relationships)

## Development Environment

Enter the Nix dev shell for all required tooling:

```bash
nix develop
```

This provides: Go, PostgreSQL client, SQLite, Hasura CLI, Nhost CLI, mockgen, bun, rover, skopeo.

**Important**: CGO must be enabled for SQLite support (`CGO_ENABLED=1`). The Nix shell handles this.

### Build

```bash
make build                    # Nix build -> ./result/bin/constellation
make build-docker-image       # Docker container for native arch
```

### Dev Environments

```bash
make dev-env-up               # Docker Compose (PostgreSQL)
make dev-env-down             # Stop and clean up

make dev-env-integration-up   # Full Nhost environment for integration tests
make dev-env-integration-down # Stop integration environment
```

### Running Locally

```bash
make run                      # Run Docker container with integration database
```

Or directly:

```bash
./result/bin/constellation serve \
  --metadata-path /path/to/metadata/ \
  --nhost-graphql-database-url postgres://... \
  --enable-playground
```

### Testing

```bash
# Unit tests (most packages)
go test ./connector/...
go test ./controller/...
go test ./metadata/...

# Tests requiring CGO (SQLite)
CGO_ENABLED=1 go test ./connector/sql/sqlite/...

# Integration tests (requires dev-env-integration-up)
go test ./integration/...

# Update golden files
go test ./connector/sql/graphql/queries/... -update
go test ./connector/sql/graphql/schema/... -update
```

Golden file tests live in `testdata/` directories. Update them with the `-update` flag when making intentional changes to generated SQL or schemas.

**Golden file ordering pitfall.** A subset of goldens are JSON-marshalled via `encoding/json/v2` from Go maps (e.g. `*_data.json` query result fixtures, `TestIntrospect/success.golden.json`, and aggregate result data). JSON v2 emits map keys in Go map iteration order, which is **deliberately randomized** — so re-running `-update` against an unchanged codebase produces a byte-different file even though the content is semantically identical. Treat noisy reorderings as nondeterminism artefacts, not real changes: revert them with `git checkout --` instead of committing. If a test passes against the existing golden, the golden is correct; don't run `-update` on it without a real reason. The same applies to `integration/schema.nhost.*.graphqls` produced by `rover graph introspect` — those are byproducts of `integration/gen.sh` runs, not goldens proper. Only the GraphQL SDL goldens under `connector/.../testdata/*.graphqls` are deterministically ordered (via sorted scalar/type emission in `connector/sql/graphql/schema/scalars.go`) and safe to commit verbatim.

## Code Standards

- Go is the primary language. Follow existing patterns in the codebase.
- Do not modify files under `vendor/`. Run `go mod vendor` after dependency changes.
- Always handle errors in Go -- never ignore them with `_`.
- **Avoid `//nolint:exhaustruct`** for internal types. Prefer initializing all struct fields. Only use for external types you don't control (e.g., `cli.Command`, `http.Client`).
- In general, avoid nolint directives. Only use them for genuine false positives.
- Generated mocks are in `mock/` directories. Regenerate with `go generate ./...` using `mockgen`. Never hand-write mocks.
- Test file naming: `foo_internal_test.go` (`package foo`) for white-box tests of unexported types, `foo_test.go` (`package foo_test`) for black-box tests through the public API. White-box test files cannot import `mock/` subdirectories of the same package (import cycle); use the external test package for tests that need mocks.
- **No `export_test.go` re-exports.** Do not declare exported identifiers in `*_test.go` files. The `export_test.go` mechanism — putting exported symbols in a file that only compiles during testing — is **banned**. Likewise, do not add an exported symbol to production code whose only consumers are tests. (One exception: boundary interfaces exported so `mockgen` can target them from the `mock/` subpackage are fine — the mock subpackage imports them like any external consumer would, and the interface is part of the documented public contract.) If a mocked test needs access to unexported state (private fields, unexported functions, struct literal construction with private fields), write the test as white-box (`package foo` in `foo_internal_test.go`) and declare inline stub types implementing the relevant interface inside the test file. White-box tests cannot import the same package's `mock/` subdirectory (import cycle), so when a Client-style type is constructed only through `New*` constructors that take real connections, the white-box test path with inline stubs is the answer — not an exported "for testing" constructor.

### Mandatory post-change checks

**After every change to Go source files, before reporting work as complete, you MUST run both of the following from the repo root, in this order:**

1. **Format the entire tree:**
   ```bash
   golines -w --base-formatter=gofumpt .
   ```
2. **Lint the entire project with auto-fix:**
   ```bash
   golangci-lint run --fix ./...
   ```

Both commands operate on the whole project, not just the files you touched -- this catches collateral fallout (e.g. import reorganisations, struct-field exhaustiveness, dead code) and keeps the tree consistently formatted. Treat any remaining `golangci-lint` finding as a blocker: either fix it or justify a targeted `//nolint:<linter>` with a comment explaining why.

If either command modifies files, re-stage them and include those changes in the same commit as the original work. Do not commit code that has not been through both steps.

## Go Package Design Rules

These rules guide both new code and reviews of existing packages. They are deliberately stricter than what `golangci-lint` enforces, because they target design and architecture concerns a linter cannot see. The `/go-package-review` skill (`.claude/skills/go-package-review/SKILL.md`) applies these same rules when auditing a package.

### Must-fix (blocking)

- **Cohesion.** Every symbol in a package must clearly belong to that package's single area of concern. Move misfits to a sibling package or extract a subpackage.
- **Subpackage extraction.** When 2–3 related exported symbols form a clear sub-concern (e.g. a parser inside a compiler), extract them into a subpackage.
- **Interfaces at external-system boundaries.** Define an interface in the consuming package for any dependency on an *external system* -- something that requires infrastructure or is otherwise hard to exercise in a unit test. This includes databases, HTTP/REST APIs, message brokers, filesystems, clocks, and concrete types that are so complex to construct that you only really care about one or two of their methods. The point is testability: if a fake or mock would materially simplify tests, hide the dependency behind an interface. This rule is *not* about "any type from another Go module" -- pure, easy-to-construct value types from external modules can be used directly.
- **`//go:generate mockgen` for every boundary interface.** Each interface that represents an external-system boundary needs a `//go:generate mockgen -package mock -destination mock/<name>.go . <Interface>` directive directly above it. Mocks must live in a `mock/` subdirectory generated by `mockgen` -- never hand-written.
- **Public test coverage.** Every exported function and method must have tests, and tests for public symbols must use `package foo_test` (black-box). Use `make coverage PACKAGE=<path>` to identify gaps; the command emits `coverage.out` for analysis.
- **Mocked tests AND integration tests.** Mocked tests (via mockgen) should cover all logic branches and guard against regressions. Integration tests must validate that the mocks behave the way the real dependencies do.
- **Struct initialisation (`exhaustruct`).** Never use `//nolint:exhaustruct` for types defined in this package -- always initialise every field explicitly. Permitted exceptions: external types you do not own, and returning a zero-value struct alongside an error (`return MyStruct{}, fmt.Errorf("...: %w", err) //nolint:exhaustruct`). The nolint is only acceptable on error paths.
- **Error wrapping.** Errors from other packages or external dependencies must be wrapped with call-site context: `return fmt.Errorf("loading config: %w", err)`. Never `return err` naked from a function that does I/O or calls into another package. Never swallow errors by assigning to `_` or ignoring them in an `if`.

### Should-fix (address before next release)

- **Unexported by default.** Every exported symbol must be justified by actual usage outside its package. Tests inside the same module do *not* count as justification. Pay special attention to exported struct fields -- they are often unnecessarily public.
- **Internal test placement.** Complex unexported logic (parsing, state machines, algorithms) goes in `mypkg_internal_test.go` using `package foo` (white-box). Do not mix `package foo` and `package foo_test` declarations in the same file.
- **Constructor hygiene.** Exported structs with required non-zero fields must have a `New*` constructor instead of relying on literal initialisation.
- **Table-driven tests.** Public functions with multiple input/output cases must use the `tests := []struct{...}{...}; for _, tt := range tests { t.Run(tt.name, ...) }` pattern. No `TestFoo1`, `TestFoo2`, `TestFoo3` duplication.
- **No superfluous comments.** Remove comments that just restate the code, or that depend on context the reader does not have ("this is needed for X to work" without saying what X is).
- **Package-level godoc.** Every package must have a godoc comment on the `package` declaration explaining its purpose and area of concern.
- **Sparse nolint directives.** `nolint` is acceptable when the fix isn't worth the complexity, but use it sparingly and always with a justification.

### Consider (design suggestions)

- **Godoc on every export.** Every exported symbol should have a godoc comment beginning with the symbol's name, even where linters miss it.

## Key Interfaces

- **`connector.Connector`** (4 methods): `GetSchema()`, `Execute()`, `GetTypeName()`, `Close()`. Implemented by `sql.Connector`, `remoteschema.Connector`, `memconnector.Connector`.
- **`connector/sql.Driver`** (5 methods): `Introspect()`, `ExecuteOperations()`, `ExecuteMultiplexedOperation()`, `Dialect()`, `Close()`. Implemented by `postgres.Client`, `sqlite.Client`.
- **`Dialect`** (29 methods): Abstracts all SQL syntax differences. Implementations: `PostgresDialect`, `SQLiteDialect`.
- **`subscription.Handler`** (3 methods): `Start()`, `Stop()`, `Shutdown()`. Implemented by `sql/subscription.Handler`.
- **`metadata.MetadataSource`** (3 methods): `InitialLoad()`, `Watch()`, `Close()`. Implementations: `FileMetadataSource` (one-time load), `DatabaseMetadataSource` (polls `hdb_catalog`).
- **`websocket.MessageHandler`** (4 methods): `OnConnectionInit()`, `OnSubscribe()`, `OnComplete()`, `OnClose()`. Implemented by `controller.WebSocketHandler`.

## Key Architectural Concepts

- **Execution flow**: HTTP Request -> Session/role extraction -> Role-specific schema selection -> Query parsing/validation -> Query planning (route fields to connectors) -> Connector execution -> Remote relationship resolution -> Response
- **Dialect pattern**: `Dialect` interface (`connector/sql/graphql/queries/dialect/`) abstracts all SQL syntax differences between PostgreSQL and SQLite. New SQL generation should go through `dialect.Dialect` (the `queries.Dialect` alias also still works) -- never hardcode database-specific syntax. Concrete implementations live in `dialect/postgres.go` and `dialect/sqlite.go`. Construct dialect values via `dialect.NewPostgresDialect()` / `dialect.NewSQLiteDialect()`. Note: `JSONAggQuotedAlias(alias)` quotes the alias for use as an identifier key; `JSONAggRawExpr(expr)` takes a raw SQL expression -- the name tells you which one to use.
- **Capabilities**: `Capabilities` struct (`connector/sql/graphql/schema/schema.go`) controls which GraphQL features are exposed based on what the database supports (regex, JSONB, DISTINCT ON, functions). Gate new database-specific features behind a capability flag.
- **Role-based schemas**: Each role gets its own GraphQL schema based on permission metadata. The admin role has unrestricted access.
- **Multi-connector composition**: `SchemaComposer` merges schemas from all connectors (databases + remote schemas). The controller routes each root field to its owning connector via `fieldToConnector` and `typeToConnector` maps.
- **Remote relationships**: Cross-connector relationships are resolved by `controller/resolver/` after initial connector execution. Join keys are collected during the first pass, then used to fetch related data from the remote connector.
- **VariableTracker**: All user-provided values in SQL go through `VariableTracker.Add()` which returns a placeholder (`$1` for Postgres, `?` for SQLite). Never build SQL by string concatenation with user values.
- **Permission injection**: `ApplySelectPermissions` wraps queries with additional WHERE clauses and column restrictions. Permissions can reference session variables (`X-Hasura-User-Id`, etc.).
- **Subscriptions**: SQL subscriptions use multiplexed polling -- `CohortManager` groups subscriptions with identical queries into cohorts sharing a single SQL poll. `StreamCohortManager` handles cursor-based `subscription_stream`.
- **Atomic state swaps**: `Controller` uses `atomic.Pointer[controllerState]` for lock-free metadata hot-reload. In-flight requests complete against old state; new requests use updated state. Old connectors and subscription handlers are shut down in a background goroutine. When modifying controller state, always work through `buildState()` -- never mutate `controllerState` fields directly.
- **Authentication flow**: `controller/middleware` extracts session from requests in priority order: (1) admin secret header grants admin role, (2) JWT token validated against configured secrets with Hasura claims extraction, (3) fallback to public role. Session variables from `X-Hasura-*` headers are injected into SQL permission WHERE clauses.
- **Remote schema presets**: `connector/remoteschema/` uses `@preset(value: "...")` directives in SDL to hide arguments from non-admin roles and inject values (literals or session variables like `x-hasura-user-id`). Admin role always gets the live introspected schema; other roles use SDL from metadata.

## Review Guidelines

When reviewing PRs:
- Check for proper error handling and propagation.
- Ensure new SQL generation goes through the `Dialect` interface, not hardcoded syntax.
- Verify golden file tests are updated when SQL or schema output changes.
- Watch for security issues: SQL injection (use parameterized queries via `VariableTracker`), credential leaks.
- Check that new database features are gated behind `Capabilities` flags.
- Ensure tests are included for new functionality.
