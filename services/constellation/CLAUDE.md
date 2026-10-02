# Project Overview

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

**Design rules**: Repo-wide Go rules live in `.claude/docs/go-design-rules.md` — load that first. Constellation-specific invariants (Dialect, Capabilities, parameterised SQL through `dialect.Placeholder`, `controllerState`/`buildState`, golden-file regeneration with the JSON v2 ordering caveat) are documented in the "Key Architectural Concepts" and "Development Environment" sections below.

Constellation is a GraphQL backend server for Nhost that replaces Hasura. It introspects databases, generates role-based GraphQL schemas with permissions, and executes queries, mutations, and subscriptions. Supports PostgreSQL and SQLite as database backends, plus remote GraphQL schemas.

The Go module lives at the repo root (`github.com/nhost/nhost`) with a single shared `vendor/` directory — do not add per-project `go.mod` or `vendor/` here.

## Structure

- `build/` - Docker Compose and dev environment configs
- `cmd/` - CLI commands: `serve` (main server), `metadata` (metadata utilities). The `schema` (SDL dump/diff) subcommand lives in the Nhost CLI (`cli/cmd/schema/`)
- `connector/` - Data source abstraction layer. `connector.Connector` interface for executing operations and exposing role-specific schemas. Subpackages:
  - `composer/` - `Composer` merges per-role schemas from multiple `SchemaProvider`s into one composed schema graph and a routing map (field/type -> owning connector)
  - `customization/` - Applies metadata customizations (root-field rename, type-name prefix/suffix) to schemas and operations
  - `groupedaggregate/` - Shared dispatcher and SQL helpers for grouped aggregate queries (`*_aggregate { group_by }`)
  - `memconnector/` - In-memory connector for fixed query/value mappings (used by tests and as a thin building block)
  - `relationships/` - Cross-connector relationship metadata: parses, validates, and applies remote relationships at the connector layer
  - `remoteschema/` - Remote GraphQL schema connector. Introspects remote endpoints, applies permissions, forwards operations
  - `schemamerge/` - Helpers to merge schemas (types, fields, directives) while detecting conflicts
  - `sql/` - Shared SQL connector. `Driver` interface abstracts database-specific operations (introspect, execute, dialect). Subpackages:
    - `graphql/queries/` - SQL query builders. Translates GraphQL operations into parameterized SQL. `dialect.Dialect` interface abstracts PostgreSQL vs SQLite syntax. Largest package (~75 files). Golden file tests in `testdata/`
    - `graphql/schema/` - GraphQL schema generation from introspected objects. `Capabilities` struct gates features by database type. Golden file tests in `testdata/`
    - `postgres/` - PostgreSQL driver (pgx pool)
    - `sqlite/` - SQLite driver (go-sqlite3, requires CGO). WAL mode, foreign keys enforced
    - `introspection/` - Database introspection types (`Objects`, `Function`)
    - `subscription/` - Subscription polling with multiplexed queries and cohort management
- `controller/` - HTTP request handling and GraphQL execution orchestration. Parses requests, selects role-specific schemas, plans queries across connectors, resolves remote relationships. Subpackages:
  - `introspection/` - GraphQL `__schema` / `__type` introspection responses for the composed schema
  - `middleware/` - Session extraction from HTTP requests. Three-tier auth: admin secret -> JWT -> public role fallback. `X-Hasura-*` headers become session variables
  - `planner/` - Analyzes GraphQL operations to detect remote relationships, determines phantom fields (join columns) to inject, transforms ASTs per connector (stripping relationship fields, filtering fragments)
  - `relationships/` - Controller-side helpers for resolving relationship configuration against the composed schema
  - `resolver/` - Executes cross-connector relationship queries after primary execution and stitches results back. Two strategies: `DatabaseResolver` (WHERE IN batching) and `SchemaResolver` (aliased field batching)
  - `websocket/` - `graphql-transport-ws` protocol handler. Pure protocol layer (read/write pumps, message routing, ping/pong). Business logic delegated to `MessageHandler` interface
- `graph/` - Intermediate GraphQL schema representation (`Schema`, `ObjectType`, `Field`, etc.) with `ToAST()` conversion to gqlparser types
- `metadata/` - Configuration parsing. Reads Hasura-compatible YAML or TOML metadata defining databases, tables, permissions, relationships, remote schemas, and functions. `metadata/source/` holds the `FileMetadataSource` (one-time file load) and `DatabaseMetadataSource` (polls `hdb_catalog`) implementations of `MetadataSource`. Custom YAML decoders (`TableMetadata`, `SelectPermissionConfig`) must capture unknown sibling keys explicitly for file-export snapshots; `json:",embed"` alone only preserves JSON-decoded unknowns. Computed-field wire lists preserve JSON-safe raw values plus per-entry decode errors, including malformed YAML scalars: convert decoded YAML directly to JSON one list member at a time, never via YAML re-marshaling. Unknown YAML keys that cannot be represented in JSON are omitted individually in file snapshots; TOML export rejects invalid computed fields/grants rather than dropping their error markers. Inline tables in `databases.yaml` retain the legacy `[]any` re-marshal path: quoted YAML-special scalars (such as `.inf`) can become non-JSON values, invalidating the affected computed entries; tabs can also be lost without an error. Use `!include` for exact fidelity. Never capture nested inline YAML with `yaml.RawMessage`: goccy/go-yaml can drop the digits of `\\x`/`\\u`/`\\U` escapes and reject merge-key overrides, including in permission filters.
- `subscription/` - Subscription handler interface and types (`Request`, `Update`, `Handler`)
- `integration/` - Integration tests against real PostgreSQL and Nhost environments
- `internal/` - Internal utilities:
  - `jwt/` - JWT validation (HMAC/RSA, static keys, JWKS URLs). Multiple secrets with fallthrough. Extracts Hasura claims and builds session variables
  - `jsonpath/` - Dot-separated JSON path navigation with array flattening. Used by planner/resolver for phantom field injection and result manipulation
  - `requestcontext/` - Context value storage for HTTP headers and logger propagation through middleware chain
  - `lib/lru/` - Thread-safe generic LRU cache (used by controller query cache)
  - `github.com/nhost/nhost/internal/lib/oapi/middleware` (repo-root shared package, not under constellation's `internal/`) - Gin middleware for CORS, request logging (slog), and B3 distributed tracing
  - `github.com/nhost/nhost/internal/lib/syncmap` - typed generic map safe for concurrent use
  - `lib/testdb/` - Spins up a PostgreSQL test database (per-test schemas) for connector and integration tests
  - `lib/testhelpers/` - Golden file testing helpers (JSON and GraphQL schema comparison)
- `docs/developers/` - Architecture, query execution pipeline, customization, remote relationships, remote schemas, subscriptions
- `docs/user/` - User-facing documentation: Hasura metadata support matrix, PostgreSQL features, remote schema configuration

## Development Environment

Enter the Nix dev shell for all required tooling:

```bash
nix develop
```

This provides: Go, PostgreSQL client, SQLite, Hasura CLI, Nhost CLI, mockgen, bun, skopeo.

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

### Integration comparisons and regression tests

The existing `integration/` suite compares Constellation with Nhost Hasura. During active development, use those comparisons for sanity checks and investigating reported differences, not as the sole or exhaustive source of regression coverage. Add direct Constellation tests with explicit expectations for implemented behavior (for example, metadata, schema, SQL, execution and permissions), and turn discovered bugs into independent regressions. Those tests should remain useful if the Hasura comparison harness is retired after stabilization. The scope of comparison tests for a particular feature belongs in that feature's plan, not in this project-wide guide.

**Golden file ordering pitfall.** A subset of goldens are JSON-marshalled via `encoding/json/v2` from Go maps (e.g. `*_data.json` query result fixtures, `TestIntrospect/success.golden.json`, and aggregate result data). JSON v2 emits map keys in Go map iteration order, which is **deliberately randomized** — so re-running `-update` against an unchanged codebase produces a byte-different file even though the content is semantically identical. Treat noisy reorderings as nondeterminism artefacts, not real changes: revert them with `git checkout --` instead of committing. If a test passes against the existing golden, the golden is correct; don't run `-update` on it without a real reason. The same applies to `integration/schema.nhost.*.graphqls` produced by `nhost schema dump` (invoked from `integration/gen.sh`, which now shells out to the Nhost CLI in `cli/`) — those are byproducts of `integration/gen.sh` runs, not goldens proper. Only the GraphQL SDL goldens under `connector/.../testdata/*.graphqls` are deterministically ordered (via sorted scalar/type emission in `connector/sql/graphql/schema/scalars.go`) and safe to commit verbatim.

## Key Interfaces

- **`connector.Connector`** (5 methods): `GetSchema()`, `Execute()`, `ValidateOperation()`, `GetTypeName()`, `Close()`. Implemented by `sql.Connector`, `remoteschema.Connector`, the unexported `customizedConnector` wrapper, and the unexported `memconnector` type returned by `memconnector.New`.
- **`connector/sql.Driver`** (5 methods): `Introspect()`, `ExecuteOperations()`, `ExecuteMultiplexedOperation()`, `Dialect()`, `Close()`. Implemented by `postgres.Client`, `sqlite.Client`.
- **`Dialect`**: Abstracts all SQL syntax differences. Implementations: `PostgresDialect`, `SQLiteDialect`.
- **`subscription.Handler`** (3 methods): `Start()`, `Stop()`, `Shutdown()`. Implemented by `sql/subscription.Handler`.
- **`metadata.Source`** (4 methods): `InitialLoad()`, `Watch()`, `HasuraSnapshotJSON()`, `Close()`. Implementations: `FileMetadataSource` (one-time load), `DatabaseMetadataSource` (polls `hdb_catalog`). `HasuraSnapshotJSON()` returns `(nil, 0)` for the TOML file source and prior to `InitialLoad`. When checking that `CONSTELLATION_METADATA_DATABASE_URL` polling has completed via `export_metadata`'s resource version, set `CONSTELLATION_HASURA_UPSTREAM_URL=`; otherwise the default proxy returns upstream Hasura metadata immediately instead of the polled snapshot. Hasura v3 `export_metadata` returns the metadata object directly (`version`, `sources`, etc.), not inside a `metadata` envelope; `replace_metadata` takes that object as `args.metadata`. In destructive probes, check the export shape before DDL, keep the snapshot in memory, restore it in a `finally`/cleanup before dropping probe functions, and verify both metadata equality and `get_inconsistent_metadata` after cleanup.
- **`websocket.MessageHandler`** (4 methods): `OnConnectionInit()`, `OnSubscribe()`, `OnComplete()`, `OnClose()`. Implemented by `controller.WebSocketHandler`.

## Key Architectural Concepts

- **Execution flow**: HTTP Request -> Session/role extraction -> Role-specific schema selection -> Query parsing/validation -> Query planning (route fields to connectors) -> Connector execution -> Remote relationship resolution -> Response
- **Dialect pattern**: `Dialect` interface (`connector/sql/graphql/queries/dialect/`) abstracts all SQL syntax differences between PostgreSQL and SQLite. New SQL generation should go through `dialect.Dialect` (the `queries.Dialect` alias also still works) -- never hardcode database-specific syntax. Concrete implementations live in `dialect/postgres.go` and `dialect/sqlite.go`. Construct dialect values via `dialect.NewPostgresDialect()` / `dialect.NewSQLiteDialect()`. Note: `JSONAggQuotedAlias(alias)` quotes the alias for use as an identifier key; `JSONAggRawExpr(expr)` takes a raw SQL expression -- the name tells you which one to use.
- **Capabilities**: `Capabilities` struct (`connector/sql/graphql/schema/schema.go`) controls which GraphQL features are exposed based on what the database supports (regex, JSONB, DISTINCT ON, functions). Gate new database-specific features behind a capability flag.
- **Role-based schemas**: Each role gets its own GraphQL schema based on permission metadata. The admin role has unrestricted access.
- **Multi-connector composition**: `composer.Composer` (in `connector/composer/`) merges per-role schemas from all connectors (databases + remote schemas) into a composed schema graph. The controller routes each root field to its owning connector via the operation-qualified `fieldToConnector` map keyed with `schemamerge.FieldKey`, and tracks object type ownership via `typeToConnectors` (`map[type][]connector`). Structurally identical object types can be owned by multiple connectors. SQL `GetTypeName(schema.table)` must use the schema-qualified generated GraphQL name (`cf_select_items` for `cf_select.items`, unlike `public.items`), because remote joins resolve their target by this method; returning only the bare table name silently breaks non-public cross-source targets.
- **Remote relationships**: Cross-connector relationships are resolved by `controller/resolver/` after initial connector execution. Join keys are collected during the first pass, then used to fetch related data from the remote connector. Remote query plans carry separate response-key paths for stitching and GraphQL field-name paths for validation errors. SQL builders stamp field names; `customization.ForwardArgumentPath` must map native root names back to client field names for prefix/suffix and namespace (the reversed AST preserves the client response key in `Alias`, which is not the validation path).
- **Parameterized SQL only**: User-provided values flow into a `params []any` slice paired with a `paramIndex` counter. Builders call `dialect.Placeholder(paramIndex)` to emit `$N` (Postgres) or `?` (SQLite). Never build SQL by string-concatenating user values; always thread values through the params slice. See `connector/sql/graphql/queries/values/` for the AST-to-Go conversion helpers feeding this pipeline. In PostgreSQL catalog queries, cast placeholders inside polymorphic `format('%I.%I', $N::text, ...)` calls: PostgreSQL cannot infer the uncast parameter type there (`42P18`). Bare computed-field function references resolve in `public`, not through `search_path`; carry the resolved catalog schema/name into later SQL.
- **Permission injection**: The permissions package (`connector/sql/graphql/queries/permissions/`) exposes a `Store` that resolves per-role select/insert/update/delete rules, wraps queries with additional WHERE clauses, and restricts visible columns. Permissions can reference session variables (`X-Hasura-User-Id`, etc.) which are substituted at execution time.
- **Subscriptions**: SQL subscriptions use multiplexed polling (`connector/sql/subscription/`). The `cohortManager` groups subscriptions with identical queries into cohorts sharing a single SQL poll; the `streamCohortManager` handles cursor-based `subscription_stream`. Both are unexported and constructed through `subscription.Handler`.
- **Atomic state swaps**: `Controller` uses `atomic.Pointer[controllerState]` for lock-free metadata hot-reload. In-flight requests complete against old state; new requests use updated state. Old connectors and subscription handlers are shut down in a background goroutine. When modifying controller state, always work through `buildState()` -- never mutate `controllerState` fields directly.
- **Inconsistency-tolerant builds**: once `metadata.Source` returns a parsed document, every downstream failure is recorded as a `metadata.Inconsistency` and the offending entity is dropped at the finest granularity available — whole source (`database`/`remote_schema`), whole role (`role`), or one table/column/function/relationship/enum_values entry within a source. The collector lives on `controllerState` and is exposed by `Controller.Inconsistencies()`. SQL-source filtering happens in `connector/sql/reconcile.go`; driver-level introspection (`introspectEnumValues`, `introspectFunctions`) silently elides per-entity gaps so reconcile can record them rather than aborting the whole connector. PostgreSQL computed functions are resolved per table/field and bad definitions drop only that field; a malformed/invalid computed grant or a known computed reference in a select/update/delete filter or insert/update check drops the **entire affected permission**, never its filter/check alone. Valid scalar grants enable executable PostgreSQL scalar selections; grants with accepted but deferred non-base argument types remain while their selections are omitted. Non-base return types are invalid and revoke the affected select permission; unrelated permissions survive. Computed argument names count only unnamed user inputs after excluding row/session slots; named inputs do not advance `arg_N`. Hasura's default computed descriptions omit `public.` for public function/table names but qualify non-public names. Conflicting `_args` input types in composed roles drop only the affected selection and record a `computed_field` inconsistency. A definition or grant on the table identifies a computed predicate across roles, including if the function is invalid. A key with neither definition nor grant cannot be inferred as computed from its spelling: an unidentifiable `missing_computed` filter key retains the ordinary unknown filter key's **source-wide** root-construction failure. Hasura drops only that invalid key's permission; this is a documented invalid-key divergence, not supported computed-field parity. Keep a column-only unknown-key control when changing this behavior. **User-facing rules**: see `docs/user/inconsistencies.md` for the full catalogue, what each kind drops, and the source-type matrix.
- **Authentication flow**: `controller/middleware` extracts session from requests in priority order: (1) admin secret header grants admin role, (2) JWT token validated against configured secrets with Hasura claims extraction, (3) fallback to public role. Session variables from `X-Hasura-*` headers are injected into SQL permission WHERE clauses.
- **Remote schema presets**: `connector/remoteschema/` uses `@preset(value: "...")` directives in SDL to hide arguments from non-admin roles and inject values (literals or session variables like `x-hasura-user-id`). Admin role always gets the live introspected schema; other roles use SDL from metadata.
