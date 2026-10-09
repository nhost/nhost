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

Nix flake source filtering excludes untracked files: before a Nix build of new Go
sources or fixtures, use `git add -N <new paths>` (intent-to-add, without staging
file contents). Otherwise the local `go test` can pass while Nix reports missing
symbols from omitted files. For a scratch docs Nix check on macOS, resolve the
scratch directory with `realpath` before using `path:<directory>#checks...`:
`/tmp` is a symlink to `/private/tmp`, and Nix rejects `path:/tmp/...`.

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

`golangci-lint run --fix` may flatten an embedded-struct literal into promoted
fields, which then fails `exhaustruct` on a second lint pass. For a composite
adapter that needs all fields initialized, prefer a named member with forwarding
methods rather than an embedded field and verify a second lint run is clean.

After the required root `golines -w --base-formatter=gofumpt .`, also run `golines -w --base-formatter=gofumpt services/constellation` when its files remain in `golines -l --base-formatter=gofumpt services/constellation`: the `.` invocation has not recursed into all Constellation files in practice. Verify the final `-l` output is empty, including after lint auto-fixes. For whole-root lint, use the storage Nix shell so `pkg-config` can find libvips for `services/storage/image`.

### Integration comparisons and regression tests

PostgreSQL dependent inserts use `core.InsertPlan`, built in
`connector/sql/graphql/queries/mutation_insert_steps.go` and run by
`connector/sql/postgres/insert_steps.go` on the root transaction. Test nested
mutations through `postgres.Client.ExecuteOperations`, not `op.SQL` (the flat
insert path still uses SQL). Testdb on `:5433` has a default `go test -p` and
`-parallel` connection budget: its default DSN disables TLS because pgx's
`sslmode=prefer` against the TLS-disabled testdb creates two backends per
connection attempt; under SCRAM and default parallelism this can exhaust the
postmaster child limit (53300) even with few active sessions. Respect an
explicit `DATABASE_URL`. Reuse and close pools at test cleanup; never
add a second pool per subtest or reduce global parallelism to mask exhaustion.
For large independent computed-permission testdb matrices, keep one parallel top-level test with sequential per-case subtests and close each connector in the case cleanup; making every matrix top-level test parallel exhausts :5433 even though each individual case closes its pool. If a Nix `make check` fails with SQLSTATE 53300 despite direct default-parallel `go test` passing, inspect newly added controller testdb fixtures: three extra parallel top-level tests can exceed the Nix cross-package connection budget. Keep those fixture-owning top-level tests serial (their subcases already run sequentially) and rerun unchanged default Nix concurrency; do not set `-p`/`-parallel` as a workaround. Likewise, constructing multiple SQL connectors over one isolated test schema in parallel can race their catalog-function initialization (`tuple concurrently updated`); serialize those per-variant subtests without changing global Go test parallelism. Use package-scoped `go generate` for changed interfaces, not `go generate
./...` (unrelated live-schema clients may be rewritten). Hasura cleanup
mutations need distinct aliases so every cleanup field executes. Root mutation
`returning` uses captured root rows without reapplying their select filter;
related selections still apply target select permissions. In typed transport
fixtures, a manual relationship mapping over `json` may carry insert FKs, but
cannot serve as a returning join (`json = json` has no PostgreSQL operator);
use an ID-only sibling relationship to assert nested returning separately.
`cf_insert_order.parent.label` is NOT NULL: include it in live FK-validation
probes or the constraint error can precede the intended validation check.
Hasura's FK-validation path for an after-parent object relationship includes
`.data[0]` (the object is executed through an array batch); a before-parent
object relationship reports `.data` without an index. Hasura runs
`insert_<table>_one` through its multi-object path, so execution-time errors
(including FK validation) are rooted at `args.object[0]`, while parse-time
GraphQL errors use `args.object`; collection inserts use `args.objects[i]`.
Hasura validates each inserted row before its before-parent objects: client columns overlapping
parent-determined columns first, then each before-parent object relationship
(in hash order) whose columns overlap parent-determined or client columns.
Mirror that order in planning. Role insert presets are not client columns:
they override the FK supplied by an array, implicit after-parent object or
before-parent object relationship. Keep parsed client-column provenance so an
explicit client FK still fails validation even if that column also has a
preset (the role schema normally hides preset columns). Preset session values
still pass through typed parameter binding and ordinary permission checks.
In direct `ApplyInsertPresets` tests, use matching lowercase session markers
(`x-hasura-user-id`): metadata normalization ordinarily supplies that form,
but the argument helper itself looks up session keys exactly.

`make check` runs `integration/` against the running `constellation` container at
`:8000`. In a highly parallel Nix check, `connector/remoteschema`'s
`TestExecute_DoesNotFollowRedirect` can transiently fail with
`http: CloseIdleConnections called` instead of the expected HTTP 302; rerun the
unchanged default check once before treating that isolated transport error as a
product regression. After Go changes, run `make dev-env-down && make dev-env-up` before the
live comparison, or it tests a stale build. Do not start a second stack.
After temporary Hasura metadata/DDL oracle probes, `export_metadata` and
`get_inconsistent_metadata` can both report a clean restored baseline while
the cached GraphQL schema still selects a dropped probe column (42703) in a
later mutation. A `reload_metadata` with `reload_sources: true` on the existing
Hasura instance refreshes this cache; verify the baseline metadata before doing
so and rerun the affected integration test. This refresh does not require a
second stack or a metadata replacement.
When refreshing an already running stack with `nhost up --apply-seeds`, verify
its migration/seed logs and metadata consistency instead of trusting exit 0:
the CLI can report migration or duplicate-seed errors and still return success.
After applying metadata it runs `hasura metadata export`. Keep the integration
fixtures in the CLI export's canonical form (`<schema>_<table>.yaml` filenames,
role/name-sorted lists and exported YAML formatting); a normal refresh should
leave tracked metadata unchanged. The computed fixture parity test compares
named permission and relationship entries by identity, not list position.
The ordered-insert parent fixture has name-sorted metadata relationships;
`orderedInsertQuery` intentionally uses a different GraphQL input order, and
the expected XXH3 traversal order is pinned by `TestOrderedInsertReference`.
The existing Hasura image is v2.50.3-ce: the required `TestOrderedInsertReference`
revalidated forward/reversed nested insert order, FK errors and rollback on
that image. `cf_filtered_one`/`cf_filtered_three` are static roles used to
compare target-filtered computed-table EXISTS and aggregate ordering without
mutating live metadata. `integration/computedfields/testdata/metadata.json` has
no relationships on `cf_select.tags`: permission tests that traverse `item`
or `item_copies` must add the relationship locally, or an unknown relationship
can revoke a permission before the intended nested predicate is checked.
Hasura PostgreSQL `QualifiedTable` accepts a bare name or an object whose
`schema` is absent or null; these mean `public`, never the containing table's
schema. Hasura exports explicit schema strings, so hand-authored metadata is
where these cases arise. Test public defaults against a public-only physical
column when the parent schema also has a table with the same name; otherwise
reconciliation can validate the wrong table without a regression failing.
Multiplexed computed permissions with a SQL function
`session_argument` must retain a `core.SessionVarValue` template marker so the
permission writer emits a per-subscriber whole-session parameter; serializing
the template map would include its private NUL-key sentinel and fail PostgreSQL
JSONB parsing (22P05).

`ReinitializeTestData` truncates and reseeds integration tables in separate non-transactional statements. An interrupted run can leave `cf_select.items` or other seeded tables empty; `TestComputedFieldReference` does not reseed. Before a standalone live comparison, verify the seed rows on `:5432/local` or first run a test that invokes `ReinitializeTestData`. A completed full integration run can change the count of `public.news` from a startup snapshot with extra rows to the five canonical rows in `integration/nhost/seeds/default/30-news_entries.sql`; verify seed identities, not just the earlier count, after the suite.

In controller overlay probes, `Controller.Resolve` may put a single-SQL-connector fast-path result into unexported `rawResponse`, leaving `GraphQLResponse.Data` nil; assert via an HTTP response or a customized/remote-relationship query instead of interpreting nil Data alone as failure.

Hasura `/v1/graphql/explain` is read-only for queries and shows the generated SQL;
mutation explain is rejected (`only queries can be explained`). Hasura aggregate
`count`, column and computed operands and `nodes` share a projected root row
source: a scalar SETOF operand expands that entire source, with multiple SRFs
in the target list running in PostgreSQL lockstep. Hasura list/nodes projections observed via explain use a per-row scalar
subquery; restored oracle probes of single-object mutation returning establish
zero SETOF values yield null and multiple values raise an error and roll back.
A later restored v2.50.3-ce scratch probe directly confirmed collection
insert, upsert DO UPDATE, update, update_many and delete returning: zero
values give one null element with a successful write, one gives one object,
and multiple values fail and roll back (including a mixed insert batch). Keep
the scalar subquery inside each affected row's JSON aggregation to preserve
row count and atomic rollback; the production HTTP sanitizer hides the SQLSTATE. Grouped
remote aggregates must never call a function on the LEFT JOIN's synthetic
all-NULL target row; retain unique join keys and window bounds separately.
A restored v2.50.3-ce scratch PUBLIC enum/tracked-object type-name collision
atomically rejected metadata replacement, even with allow-inconsistent set.
Constellation's narrowly approved selection-only omission is a metadata
acceptance difference, not generic Hasura collision parity.

Read-only comparisons against an already-running Hasura stack can settle parser and presentation questions using existing columns (e.g. a `vector` comparison for unknown-scalar string parsing) or startup computed fields, without metadata writes. Never cite ignored `.nhost-code/` artifacts in tracked docs: extract only redacted observations into `integration/computedfields/testdata/`. Table-return computed selections derive access from the returned table; explicitly granting them on the parent invalidates the entire select permission. A non-SETOF table function with no matching row may yield one all-NULL composite element for unfiltered roles, rather than an empty list. Probe each query independently: a multi-row SETOF scalar error can mask other outcomes in the same GraphQL request. Independent HTTP computed-argument error tests need a real column-only PostgreSQL 22P02 control: an integer/domain column `_eq: "x"` is intercepted by strict GraphQL Int validation, so use a string-only range column for the bad cast instead. Constellation production sanitizes database errors while dev mode exposes the raw chain; strict Int rejects quoted inputs that Hasura v2.50.3-ce accepts for both computed and physical fields.

The existing `integration/` suite compares Constellation with Nhost Hasura. During active development, use those comparisons for sanity checks and investigating reported differences, not as the sole or exhaustive source of regression coverage. Add direct Constellation tests with explicit expectations for implemented behavior (for example, metadata, schema, SQL, execution and permissions), and turn discovered bugs into independent regressions. Those tests should remain useful if the Hasura comparison harness is retired after stabilization. The scope of comparison tests for a particular feature belongs in that feature's plan, not in this project-wide guide.

**Golden file ordering pitfall.** A subset of goldens are JSON-marshalled via `encoding/json/v2` from Go maps (e.g. `*_data.json` query result fixtures, `TestIntrospect/success.golden.json`, and aggregate result data). JSON v2 emits map keys in Go map iteration order, which is **deliberately randomized** — so re-running `-update` against an unchanged codebase produces a byte-different file even though the content is semantically identical. Treat noisy reorderings as nondeterminism artefacts, not real changes: revert them with `git checkout --` instead of committing. If a test passes against the existing golden, the golden is correct; don't run `-update` on it without a real reason. The same applies to `integration/schema.nhost.*.graphqls` produced by `nhost schema dump` (invoked from `integration/gen.sh`, which now shells out to the Nhost CLI in `cli/`) — those are byproducts of `integration/gen.sh` runs, not goldens proper. Only the GraphQL SDL goldens under `connector/.../testdata/*.graphqls` are deterministically ordered (via sorted scalar/type emission in `connector/sql/graphql/schema/scalars.go`) and safe to commit verbatim.

## Key Interfaces

- **`connector.Connector`** (5 methods): `GetSchema()`, `Execute()`, `ValidateOperation()`, `GetTypeName()`, `Close()`. Implemented by `sql.Connector`, `remoteschema.Connector`, the unexported `customizedConnector` wrapper, and the unexported `memconnector` type returned by `memconnector.New`.
- **`connector/sql.Driver`** (5 methods): `Introspect()`, `ExecuteOperations()`, `ExecuteMultiplexedOperation()`, `Dialect()`, `Close()`. Implemented by `postgres.Client`, `sqlite.Client`.
- **`Dialect`**: Abstracts all SQL syntax differences. Implementations: `PostgresDialect`, `SQLiteDialect`.
- **`subscription.Handler`** (3 methods): `Start()`, `Stop()`, `Shutdown()`. Implemented by `sql/subscription.Handler`.
- **`metadata.Source`** (4 methods): `InitialLoad()`, `Watch()`, `HasuraSnapshotJSON()`, `Close()`. Implementations: `FileMetadataSource` (one-time load), `DatabaseMetadataSource` (polls `hdb_catalog`). `HasuraSnapshotJSON()` returns `(nil, 0)` for the TOML file source and prior to `InitialLoad`. When checking that `CONSTELLATION_METADATA_DATABASE_URL` polling has completed via `export_metadata`'s resource version, set `CONSTELLATION_HASURA_UPSTREAM_URL=`; otherwise the default proxy returns upstream Hasura metadata immediately instead of the polled snapshot. Hasura v3 `export_metadata` returns the metadata object directly (`version`, `sources`, etc.), not inside a `metadata` envelope; `replace_metadata` takes that object as `args.metadata`. In destructive probes, check the export shape before DDL, keep the snapshot in memory, restore it in a `finally`/cleanup before dropping probe functions, and verify both metadata equality and `get_inconsistent_metadata` after cleanup. Submit Hasura `run_sql` to `/v2/query`, not `/v1/metadata` (that endpoint interprets it as an unknown metadata backend command).
- **`websocket.MessageHandler`** (4 methods): `OnConnectionInit()`, `OnSubscribe()`, `OnComplete()`, `OnClose()`. Implemented by `controller.WebSocketHandler`.

## Key Architectural Concepts

- **Execution flow**: HTTP Request -> Session/role extraction -> Role-specific schema selection -> Query parsing/validation -> Query planning (route fields to connectors) -> Connector execution -> Remote relationship resolution -> Response
- **Dialect pattern**: `Dialect` interface (`connector/sql/graphql/queries/dialect/`) abstracts all SQL syntax differences between PostgreSQL and SQLite. New SQL generation should go through `dialect.Dialect` (the `queries.Dialect` alias also still works) -- never hardcode database-specific syntax. Concrete implementations live in `dialect/postgres.go` and `dialect/sqlite.go`. Construct dialect values via `dialect.NewPostgresDialect()` / `dialect.NewSQLiteDialect()`. Note: `JSONAggQuotedAlias(alias)` quotes the alias for use as an identifier key; `JSONAggRawExpr(expr)` takes a raw SQL expression -- the name tells you which one to use.
- **Capabilities**: `Capabilities` struct (`connector/sql/graphql/schema/schema.go`) controls which GraphQL features are exposed based on what the database supports (regex, JSONB, DISTINCT ON, functions). Gate new database-specific features behind a capability flag.
- **Role-based schemas**: Each role gets its own GraphQL schema based on permission metadata. The admin role has unrestricted access.
- **Multi-connector composition**: `composer.Composer` (in `connector/composer/`) merges per-role schemas from all connectors (databases + remote schemas) into a composed schema graph. The controller routes each root field to its owning connector via the operation-qualified `fieldToConnector` map keyed with `schemamerge.FieldKey`, and tracks object type ownership via `typeToConnectors` (`map[type][]connector`). Structurally identical object types can be owned by multiple connectors. SQL `GetTypeName(schema.table)` must use the schema-qualified generated GraphQL name (`cf_select_items` for `cf_select.items`, unlike `public.items`), because remote joins resolve their target by this method; returning only the bare table name silently breaks non-public cross-source targets.
- **Remote relationships**: Cross-connector relationships are resolved by `controller/resolver/` after initial connector execution. Join keys are collected during the first pass, then used to fetch related data from the remote connector. Remote query plans carry separate response-key paths for stitching and GraphQL field-name paths for validation errors. SQL builders stamp field names; `customization.ForwardArgumentPath` must map native root names back to client field names for prefix/suffix and namespace (the reversed AST preserves the client response key in `Alias`, which is not the validation path). For computed LHS join keys, `composer` gates each role's injected field on the SQL connector's reconciled table-owned function identity, its explicit computed select grant and executable scalar source field; each target mapping must name a role-selectable SQL column by its GraphQL name, not merely a field on the target type. `relationships.fieldExists` accepts relationships too; the SQL connector's role-specific `select_column` enum proves column identity and grants, while the target object's role field proves availability in the composed schema. A relationship named like a denied, renamed column's physical SQL name otherwise bypasses the gate in grouped collection and aggregate SQL. Do not infer computed identity solely from a field name in the role schema: a rejected computed definition may collide with an existing physical column. The planner must only use relationships present in the role's validated schema before injecting phantoms, and `to_remote_schema` keys live in `LHSFields` rather than `JoinMapping` (include them in phantom collection). JSONB target columns require canonical JSON for objects, strings, arrays and numbers when sent to target `_in`; stitching/dedup must distinguish JSON strings from numbers. JSONB array `_aggregate` siblings use the same typed binding and grouped-result/parent keys for computed and physical keys. Derive target type from the role schema, falling back to the admin schema for type only when a physical relationship joins through a role-hidden column; do not change caller-role queries or the strict computed target-column grant gate. PostgreSQL `json` targets cannot be joined via either ordinary `_in` or grouped SQL (`json = json` does not exist). Null `to_source` parent keys (SQL NULL or JSONB literal `null`) always produce explicit `null` for object, array and aggregate, even in all-null batches; JSONB null never matches a target JSONB null. Hasura v2.50.3-ce does this despite declaring arrays and aggregates `NON_NULL` in SDL. Non-null keys with no match produce object `null`, array `[]` and empty aggregate. All JSON/JSONB computed keys are excluded from remote schemas (the live JSONB-object→`ID!` coercion fails). The target join-column select requirement is deliberately stricter than Hasura v2.50.3-ce, which joins on denied target values; it prevents a hidden-value equality oracle for computed `to_source` keys only, not physical keys. Paginated or `distinct_on` remote arrays must apply modifiers per parent key in the target SQL, not to the global `_in` batch; the PostgreSQL typed-tuple LATERAL path and SQLite correlated scalar path reuse the ordinary collection builder under the caller role. A database source with a root-field namespace, including one with a type-name prefix, supports remote `to_source` joins: planner paths descend through the wrapper (including fragments), customized execution lifts wrapper fragments into native root fields, and controller raw-result decoding traverses the rewrapped namespace before stitching and phantom cleanup. Role-hidden physical LHS columns remain usable without appearing in results, as observed on Hasura v2.50.3-ce for both namespace forms. Phantom injection through a named fragment must inline a path-local copy, including nested spreads: mutating a shared definition leaks the key into an unrelated spread whose cleanup path is absent. A duplicated **database** namespace field under distinct response aliases must lift each child's selection under a collision-checked internal native key and forward it to its own response path; compatible wrapper-fragment and direct selections of the same child must merge before native execution. Native alias allocation, duplicate-root merging and wrapper-fragment expansion are database-only: SQL executes root fields, not fragments. Remote schemas retain wrapper inline fragments and spreads with their directives and variable definitions, mapping wrapper type conditions to native root types; expanding them leaves unused definitions that validating remotes reject. Remote schemas forward lifted children unaliased and unmerged: identical children work, while two namespace aliases with differing child arguments produce the remote's conflicting-fields validation error instead of independent results or silently dropped mutations. Remote GraphQL error paths must not gain internal aliases. In remote forwarding tests, validate the entire forwarded operation **including fragments** against the fake server's SDL (`gqlparser.LoadQueryWithRules`); a fake that skips validation can conceal this fail-closed contract. Validation `extensions.path` under database namespace aliases retains Hasura's field-name form (`catalog.selectionSet.departments`, not a client alias), even if the path is ambiguous. `ForwardResult` must collect duplicate response-key selections before walking their shared native value: walking a raw and a decoded occurrence independently can lose fields or expose native `__typename`. Constellation's computed LHS grant and target-column gate remain stricter than Hasura. Composer and planner use the published, connector-scoped object type name for injection, while `GetTypeName` retains the native SQL root for remote target execution; derived aggregate/input types must be mapped individually. Root-field- and type-name-customized database targets forward grouped collections and aggregates through `customizedConnector` using native table identity and nested fields. Grouped executors bypass `ForwardResult`: remap selected `__typename` via the request's alias-aware selection and fragments, not raw result keys. A non-capable inner fails closed. Published type resolution for relationship injection applies to database `to_source` targets, not type-renamed `to_remote_schema` targets; no arbitrary remote-schema customization combination is implied. A single distinct non-null tuple uses the ordinary operation on either backend. SQLite's derived tuple table is chunked below its compound-SELECT and bind-variable limits; remove the ordinary operation's generated all-parent `_in` filter before building grouped collections (keep the user's `where`), or each SQLite chunk still binds the full parent set and defeats the bound. SQLite-target remote arrays receive `distinct_on` from `connector/relationships.sqlListArgs` even though SQLite roots omit it; it fails at execution. SQLite `offset` without `limit` also fails at execution (including roots). Do not infer remote-field arguments from the root SDL. SQLite grouped collections must wrap JSON-typed serialized key components in `json(...)` when constructing `_join_key`, or typed stitching loses every multi-tuple result. `to_source` target mappings reach ordinary operations and grouped collections as GraphQL field names: resolve grouped names GraphQL-first, then SQL-name fallback (a GraphQL name can equal another column's physical SQL name), and use the resolved SQL name and type in correlation. Grouped-aggregate `JoinColumnSQLName` retains SQL-name semantics for unambiguous names, but must fail closed when a name resolves both as an SQL column and as the GraphQL name of a different physical column (check the full introspected column set, not role visibility). Without this check, an aggregate could join on a hidden SQL column after the computed-key gate authorized a different GraphQL column. Hasura interprets field mappings as physical SQL names; Constellation deliberately rejects this collision. For SQLite JSON-declared targets the ordinary `_in` query returns stored JSON text in its join-key phantom; decode that text before typed stitching (including string/number distinction), while grouped queries use `json(...)` on their result key. Both paths match serialized keys to stored text, not semantic JSON: whitespace, object-key order, HTML escape or numeric-spelling differences can miss. The docs Nix check audits the root lockfile before `docs/`; verify both lockfiles when a new advisory blocks that gate. `nix build --rebuild` checks an existing output rather than creating one: first build a new docs scratch derivation without `--rebuild`; if audit fails, report that failure instead of claiming a rebuilt docs gate. For temporary Hasura oracle probes, track scratch tables in existing integration sources. Do not add and drop temporary sources: all sources share the metadata database and source removal can affect shared catalog objects. Restore metadata before dropping scratch tables, reload sources and verify the export hash, inconsistencies and baseline rows. The docs link script needs `jq`, which the docs Nix check does not provide. It then prints `Could not parse linkinator output as JSON` and exits with linkinator's own status, which is nonzero on any `BROKEN` link; only the summary is lost. Independently parse the emitted JSON and confirm `passed: true` and zero `BROKEN` links. JSONB components are encoded for SQL binding but keyed by decoded composite JSON for stitching. Validated Int variables may be Go `int`, not only `float64`; when copying remote argument ASTs, preserve their integer literal kind so `limit`/`offset` parse successfully. WebSocket `OnSubscribe` must reject remote relationships before SQL polling; HTTP `resolveData` alone does not cover subscriptions. A selected computed JSON `path` is not a full join value: inject a separate full-value phantom and remove it after stitching. Hasura may join denied computed keys; Constellation deliberately omits those relationships.
- **Parameterized SQL only**: User-provided values flow into a `params []any` slice paired with a `paramIndex` counter. Builders call `dialect.Placeholder(paramIndex)` to emit `$N` (Postgres) or `?` (SQLite). Never build SQL by string-concatenating user values; always thread values through the params slice. Never leave parameters from a discarded rendering in `params`: an unreferenced `$N` fails with 42P18 or pgx's `expected N arguments`. See `connector/sql/graphql/queries/values/` for the AST-to-Go conversion helpers feeding this pipeline. In PostgreSQL catalog queries, cast placeholders inside polymorphic `format('%I.%I', $N::text, ...)` calls: PostgreSQL cannot infer the uncast parameter type there (`42P18`). Bare computed-field function references resolve in `public`, not through `search_path`; carry the resolved catalog schema/name into later SQL.
- **Permission injection**: The permissions package (`connector/sql/graphql/queries/permissions/`) exposes a `Store` that resolves per-role select/insert/update/delete rules, wraps queries with additional WHERE clauses, and restricts visible columns. Permissions can reference session variables (`X-Hasura-User-Id`, etc.) which are substituted at execution time.
- **Subscriptions**: SQL subscriptions use multiplexed polling (`connector/sql/subscription/`). The `cohortManager` groups subscriptions with identical queries into cohorts sharing a single SQL poll; the `streamCohortManager` handles cursor-based `subscription_stream`. Both are unexported and constructed through `subscription.Handler`.
- **Atomic state swaps**: `Controller` uses `atomic.Pointer[controllerState]` for lock-free metadata hot-reload. In-flight requests complete against old state; new requests use updated state. Old connectors and subscription handlers are shut down in a background goroutine. When modifying controller state, always work through `buildState()` -- never mutate `controllerState` fields directly.
- **Inconsistency-tolerant builds**: once `metadata.Source` returns a parsed document, every downstream failure is recorded as a `metadata.Inconsistency` and the offending entity is dropped at the finest granularity available — whole source (`database`/`remote_schema`), whole role (`role`), or one table/column/function/relationship/enum_values entry within a source. The collector lives on `controllerState` and is exposed by `Controller.Inconsistencies()`. SQL-source filtering happens in `connector/sql/reconcile.go`; driver-level introspection (`introspectEnumValues`, `introspectFunctions`) silently elides per-entity gaps so reconcile can record them rather than aborting the whole connector. PostgreSQL computed functions are resolved per table/field and bad definitions drop only that field; a malformed/invalid computed grant or a known computed reference in a select/update/delete filter or insert/update check drops the **entire affected permission**, never its filter/check alone. Valid scalar grants enable executable PostgreSQL scalar selections and argument-free user `where`/`order_by` inputs; aggregate outputs include Hasura-eligible comparable/numeric returns and retain user `args`. Argument-free table-valued fields occur as boolean EXISTS and `<field>_aggregate` order inputs, with target select permissions; they also execute in role filters/checks without target select access. Argument-bearing computed fields do not occur in row inputs, and Hasura includes no **scalar** computed aggregate-order inputs. Argument-free PostgreSQL scalar computed permission filters/checks execute independently
of select grants after all tables' computed lookups are initialized; identifiable
invalid or unexecutable predicates still drop their whole permission.
Hasura rejects relationship-aggregate permission keys; identifiable computed references nested there revoke the permission, and non-computed aggregate permission parsing retains its prior behavior;
accepted domain, enum, composite, range, multirange and catalog-identified array
arguments (including user-defined element arrays) expose string-only custom scalars (composites use `<type>_scalar`;
arrays require catalog identity even outside `pg_catalog`) and bind values with
parameterized schema-qualified casts. GraphQL enum-token literals resolve to
their string names, not arbitrary enum coercions. Non-public custom
arguments execute here despite Hasura v2.50.3-ce's accepted SDL and runtime
`type "…" does not exist` failure; the public domain control executes there.
Do not infer the underlying cause from the observed error or generalize this
approved variance to other permissions/returns. Non-base returns, including `text[]` whose catalog `typtype` is `b`, are invalid and revoke an explicit granting select permission; unrelated permissions survive. A tracked table return is auto-derived from target select access whether or not declared `SETOF`; base `SETOF` returns behave as scalar selections/inputs, with PostgreSQL's set-returning cardinality and predicate error behavior. Only independently classified scalar `SETOF` returns `pg_catalog.text`, `numeric`, `int4`, `float8`, `bool`, `date`, `uuid`, `jsonb` and installed `public.citext` are enabled; even zero/one-row user `where` fails (`0A000`), direct multi-row scalar selection fails (`21000`), and `order_by` can omit/duplicate parent rows. Single-object mutation returning zero yields a null result after a successful write; collection returning yields one null array element per zero-cardinality affected row, and multi-row results roll back the entire same-source mutation. A selected scalar SETOF aggregate expands count, column/computed operands and nodes over one row source; per-parent `avg` (and variance) reductions would change the weighted result. Scalar SETOF join keys are not authorized remote keys: their relationships disappear even for admin without an inconsistency; check role SDL/validation, not only `Controller.Inconsistencies()`. A restored v2.50.3-ce scratch `SETOF text` to_source probe exposed and joined on that relationship even for roles without the computed key grant (zero parent null; multi-row error); the operator approved Constellation's narrower fail-closed omission for **all** roles. Do not weaken Phase 13's grant-bound rule or infer results for other SETOF key shapes. A role with only an update permission does not expose the update root in the isolated connector schema: grant ordinary select access as well when testing an update check separately from a SETOF update filter. A restored Hasura scratch probe separately exercised select/insert/update/delete permission predicates on SETOF scalars: metadata stayed consistent and every execution failed with a database-query error without persisting a write. Constellation's SQLSTATE `0A000` and the inherited production sanitizer remain pinned by local tests; do not claim matching client error envelopes. In grouped aggregate SQL the expanded CTE applies the `__cs_rn` window bounds and filters out synthetic `joinCol IS NULL` rows before any SRF runs; scalar computed operands are CASE-guarded against the same synthetic rows. Installed PostgreSQL without uuid min/max emits 42883 for those advertised fields. An exact computed `<rel>_aggregate` array-relationship sibling name collision records a computed inconsistency and removes only the ambiguous computed field/grant, not the genuine relationship/aggregate or the role's unrelated select permission. This is not the generic invalid-grant rule for ordinary column/relationship name collisions. Computed argument names count only unnamed user inputs after excluding row/session slots; named inputs do not advance `arg_N`. Generated and catalog user-input names must be valid, unreserved and unique GraphQL identifiers; reconciliation drops only a computed field with an invalid exposed name, because role-schema validation would otherwise drop the entire role (an explicit grant of the invalid field still revokes its select permission). Hasura's default computed descriptions omit `public.` for public function/table names but qualify non-public names. Conflicting `_args` input types or computed-argument scalar names that collide with a non-scalar composed object/enum/input type drop only the affected selection, unused input/scalar, and record a `computed_field` inconsistency. Recheck both admin and granted roles: a global schema merge failure otherwise removes an entire role. A definition or grant on the table identifies a computed predicate across roles, including if the function is invalid. A key with neither definition nor grant cannot be inferred as computed from its spelling: an unidentifiable `missing_computed` filter key retains the ordinary unknown filter key's **source-wide** root-construction failure. Hasura drops only that invalid key's permission; this is a documented invalid-key divergence, not supported computed-field parity. Keep a column-only unknown-key control when changing this behavior. **User-facing rules**: see `docs/user/inconsistencies.md` for the full catalogue, what each kind drops, and the source-type matrix.
- **Authentication flow**: `controller/middleware` extracts session from requests in priority order: (1) admin secret header grants admin role, (2) JWT token validated against configured secrets with Hasura claims extraction, (3) fallback to public role. Session variables from `X-Hasura-*` headers are injected into SQL permission WHERE clauses.
- **Remote schema presets**: `connector/remoteschema/` uses `@preset(value: "...")` directives in SDL to hide arguments from non-admin roles and inject values (literals or session variables like `x-hasura-user-id`). Admin role always gets the live introspected schema; other roles use SDL from metadata.
