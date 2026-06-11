# Query Execution

This document traces a GraphQL request through Constellation, from HTTP arrival to JSON response. It is the developer view of `controller/resolve.go`; for the per-subsystem detail see the sibling documents on [remote relationships](./remote-relationships.md), [subscriptions](./subscriptions.md), and [remote schemas](./remote-schemas.md).

## Pipeline at a glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  HTTP request → Gin handler (controller/handlers.go)                 │
│  • Recovery, Tracing, Logger, CORS middleware (B3 id; no request-id) │
│  • middleware.Session extracts session (admin / JWT / pub)           │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Controller.Resolve (controller/resolve.go)                          │
│  1. Snapshot controllerState via atomic.Pointer.Load                 │
│  2. Look up role schema (state.validatedSchemas[role])               │
│  3. loadQuery → query LRU cache (controller/querycache.go)           │
│  4. selectOperation + validateVariables                              │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Controller.execute (controller/resolve.go)                          │
│  • Introspection shortcut: __schema / __type → controller/intro…     │
│  • state.queryPlanner.Plan(operation, fragments, role)               │
│      → QueryPlan { PrimaryQueries, RemoteQueries }                   │
│  • Reject remote relationships in subscriptions                      │
│  • groupFieldsByConnector (route root fields by fieldToConnector)    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Controller.runConnectorsAndStitch                                   │
│  • validateConnectors pre-pass when fan-out >1 or remote queries     │
│  • executeConnectors: connector.Execute per owning connector         │
│  • resolveRemoteRelationships (only when plan has RemoteQueries)     │
│  • RemovePhantomFieldsFromPlan                                       │
│  • buildRawResponse fast path or json.Marshal                        │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          HTTP JSON response
```

The interesting design choice is the split between **planner** and **connector**: the planner produces a _clean operation_ per connector — with relationship fields stripped, fragments filtered, and phantom join columns already injected — so connectors never inspect cross-connector relationships at runtime. See `controller/planner/planner.go:51`.

## 1. Request handling

The HTTP entry point is `Controller.HandlerPost` in `controller/handlers.go`. The Gin chain that wraps it is configured in `getRouter` (`cmd/serve.go`) and, except for `middleware.Session`, uses shared helpers from `internal/lib/oapi/middleware`. In registration order:

- `gin.Recovery()` recovers from panics in downstream handlers.
- `Tracing` (oapimw) parses or generates the B3 identifiers, stashes the `Trace` on the request context, and writes the `X-B3-*` response headers at entry. There is no request-id middleware — the generated B3 trace id is the correlation id.
- `Logger` (oapimw) enriches a `*slog.Logger` with request and trace attributes, stashes it on the request context (`LoggerToContext`/`LoggerFromContext`), and emits one completion record after the handlers finish.
- `CORS` (oapimw) applies the fail-closed CORS policy built from the configured options.
- `middleware.Session` (in `controller/middleware/`) extracts the session, stashes the client headers via `internal/requestcontext`, and enriches the request logger via `oapimw.AddLoggerAttrs`.

Session extraction follows a strict precedence:

1. `X-Hasura-Admin-Secret` matches the configured secret → admin role, all `X-Hasura-*` headers become session variables.
2. JWT (when configured) is validated by `internal/jwt`; Hasura claims build the session.
3. No credentials → fall back to the `public` role.

The `Session` middleware stashes the resolved session on the request context (via the unexported `sessionToContext`, `controller/middleware/session.go:91`) and `Resolve` reads it back through the exported `middleware.SessionFromContext` (`controller/resolve.go:73`).

The request body is a `GraphQLRequest`:

```go
type GraphQLRequest struct {
    OperationName string         `json:"operationName"`
    Query         string         `json:"query"`
    Variables     map[string]any `json:"variables"`
}
```

## 2. State snapshot

`Controller` holds an `atomic.Pointer[controllerState]` (`controller/controller.go:99`). Each request calls `c.state.Load()` once and uses that snapshot for its entire lifetime. Metadata reloads atomically swap the pointer; in-flight requests keep running against the old state until they return. See [architecture.md](./architecture.md) for the swap protocol.

The snapshot carries: per-role validated schemas, the connector map, `fieldToConnector` routing, the planner, the per-role subscription handler map, and the LRU query cache.

## 3. Schema selection

`state.validatedSchemas` is keyed by role name. If no schema exists for the requested role, `Resolve` returns a structured error response — not a Go error — so the client receives `{"errors": [...]}` with HTTP 200. The same pattern applies to all user-facing errors throughout `Resolve`.

## 4. Parsing & validation

`loadQuery` (`controller/resolve.go:438`) memoises parsing and validation in an LRU keyed by `(queryString, role)`. The cache stores both the parsed `*ast.QueryDocument` and the `gqlerror.List` so repeated requests with invalid queries also short-circuit. Validation uses `gqlparser/v2`'s default rules plus the operation must exist by name (or be the only operation if `operationName` is empty). Variables are coerced by `validator.VariableValues` in `validateVariables`.

Validation failures produce a `GraphQLResponse` with `Errors` and `Data: nil` — `Resolve` itself only returns a Go error for unrecoverable internal failures.

## 5. Introspection shortcut

`isIntrospectionQuery` (`controller/resolve.go:423`) checks whether any root selection is `__schema` or `__type`. If so, the controller delegates to `controller/introspection.Execute`, which walks the validated schema directly — no connector calls, no planner work. The introspection package is intentionally state-less; it gets the schema and the AST and returns a map.

## 6. Query planning

```go
plan, err := state.queryPlanner.Plan(operation, fragments, role)
```

`controller/planner/planner.go:51` is the heart of multi-connector execution. For each connector that owns any root field of the operation, the planner:

1. Builds a sub-operation containing only that connector's root fields (`BuildSubOperation`).
2. Runs an **analyzer** (`controller/planner/analyzer.go`) over the sub-operation to detect remote relationships and collect the join columns each one needs as `PhantomFieldSpec` entries.
3. Runs an **AST transformer** (`controller/planner/ast_transformer.go`) to strip relationship fields, filter fragments whose `TypeCondition` belongs to a different connector, and drop fragment spreads that become empty.
4. Mutates the cloned `CleanOperation` in place to inject the planner-determined phantom fields (`injectPhantomFields`).
5. Records a `PrimaryQuery{Connector, CleanOperation, CleanFragments, PhantomFields}` and any `RemoteQueryPlan`s in the returned `QueryPlan`.

After planning, the controller rejects subscriptions that contain remote relationships:

```go
if plan.HasRemoteQueries() && operation.Operation == ast.Subscription {
    return errorResponse("remote relationships are not supported in subscriptions")
}
```

Mutations are not rejected here, but mutation pipelines never produce cross-connector results in practice — the SQL connector only generates remote queries for read paths.

## 7. Field routing

`groupFieldsByConnector` (`controller/resolve.go`) walks the _original_ operation (not the clean one) and partitions root selections by the operation-qualified `state.fieldToConnector[schemamerge.FieldKey(operation.Operation, field.Name)]` key. The mapping is built at schema composition time by `connector/composer`. Any root field whose owner is empty produces a structured error.

## 8. Pre-execution connector validation

`runConnectorsAndStitch` runs `validateConnectors` before any root connector executes when either:

- Root fields map to more than one connector. This prevents a structured argument failure in one connector from returning partial data or letting a sibling mutation commit first.
- The plan has remote relationship work. The root connectors are validated up front, and database-backed remote relationship target operations / grouped aggregate requests are validated by `validateRemoteTargets` (`controller/remote_validation.go`) before the source connector executes.

Plain single-connector requests skip the extra pass because the connector's `Execute` path already performs the same local build/validation before touching its backend. The pre-pass uses `buildConnectorOperation` to send each connector the same cleaned operation and fragments it would receive during execution. Only structured connector argument errors short-circuit here; unknown fields, internal build failures, and remote-schema endpoint validation retain the existing `Execute`/remote-resolution error paths and partial-data semantics.

## 9. Connector execution

`executeConnectors` (`controller/resolve.go:365`) iterates each connector, calls `buildConnectorOperation` to obtain the per-connector operation, and invokes `Connector.Execute`:

```go
type Connector interface {
    GetSchema() (map[string]*graph.Schema, error)
    Execute(ctx, operation, fragments, variables, role, sessionVariables, logger) (map[string]any, error)
    ValidateOperation(operation, fragments, variables, role, sessionVariables) error
    GetTypeName(identifier string) string
    Close()
}
```

`buildConnectorOperation` (`controller/resolve.go:415`) prefers the planner's `CleanOperation` + `CleanFragments` when they exist. Without a plan (programmatic embedding via `NewFromConnectors`, no relationships), it falls back to `BuildSubOperation` against the raw selections.

`Execute` returns `map[string]any`. Results from all connectors are merged into a single map keyed by root field alias. Errors are accumulated rather than fatal:

- If a `*remoteschema.GraphQLError` is returned, its `Errors` slice is appended to the response errors and any partial data is kept.
- Any other error becomes `{"message": err.Error()}`.

When _any_ connector errored, the controller short-circuits before remote-relationship resolution and returns `{data: partial, errors: [...]}`.

### SQL connector

`connector/sql.Connector.Execute` (`connector/sql/query.go:16`) is a thin wrapper:

```go
operations, err := c.roots.BuildQuery(operation, fragments, variables, role, sessionVariables)
results, err := c.driver.ExecuteOperations(ctx, operations, logger)
```

`roots.BuildQuery` lives in `connector/sql/graphql/queries/roots.go` and is the entry to the GraphQL→SQL translation layer (see the package godoc on `connector/sql/graphql/queries`). It dispatches each root field to the right builder (collection, by_pk, aggregate, insert, update, delete, function, …) and returns `core.SQLOperation` values that the driver executes through pgx or go-sqlite3.

Values returned from SQL drivers are usually `jsontext.Value` (raw JSON) so the controller can avoid double-marshalling on the response.

### Remote schema connector

`connector/remoteschema.Connector.Execute` (`connector/remoteschema/connector.go:180`):

1. Clones the operation and applies `@preset` argument injection per role and session (`applyPresets`).
2. Renders the clone + fragments to a GraphQL string with `formatter.NewFormatter`.
3. Sends the request over HTTP via `httpClient`. Forwarded headers, X-Forwarded-\* rewrites, and `forward_client_headers` rules live in `connector/remoteschema/http.go`.
4. Returns the response `data` map. Partial data is returned together with `*GraphQLError`.

## 10. Remote relationship resolution

If the plan contains remote queries, `resolveRemoteRelationships` (`controller/resolve.go:353`) runs:

```go
resolver.UnmarshalRawResults(results)
pending := resolver.BuildRemoteQueriesFromPlan(results, plan, fragments, typeNameResolver)
state.remoteRelationshipResolver.Resolve(ctx, results, pending, ...)
```

`UnmarshalRawResults` materialises any `jsontext.Value` entries into nested Go maps so `jsonpath` can traverse them. `BuildRemoteQueriesFromPlan` (`controller/resolver/remote_query_builder.go:20`) walks `plan.RemoteQueries`, extracts join values from the parent results, deduplicates by join key hash, and selects the right resolver strategy:

- `planner.ResolverKindDatabase` → `DatabaseResolver` (`controller/resolver/database_resolver.go`) — translates to a `WHERE col IN (...)` query against the target connector.
- `planner.ResolverKindSchema` → `SchemaResolver` (`controller/resolver/schema_resolver.go`) — renders an aliased GraphQL field against the remote schema.
- `IsArrayAggregate` plans skip the resolver entirely and instead carry an `AggregateInfo` payload that dispatches to the connector's `groupedaggregate.Executor`.

`RemoteRelationshipResolver.Resolve` (`controller/resolver/remote_relationship_resolver.go:45`) executes each pending query, stitches results into the parent map, and removes remote phantom fields immediately. After all queries finish, it removes the local phantom fields it added to the source query.

See [remote-relationships.md](./remote-relationships.md) for the full mechanics.

## 11. Phantom field cleanup

`resolver.RemovePhantomFieldsFromPlan` (`controller/resolver/remote_relationship_resolver.go:200`) sweeps the result map a final time, removing every phantom field recorded in `plan.AllPhantomFieldSpecs()`. This is the catch-all that ensures phantom columns from primary queries are gone even when no remote relationship ended up needing them (e.g. all parent rows had null join keys).

## 12. Response assembly

`buildRawResponse` (`controller/resolve.go:459`) is the fast path: if every value in `results` is already a `jsontext.Value`, the function concatenates them into a pre-sized byte buffer wrapping them in `{"data":{...}}`. The HTTP handler writes those bytes directly, skipping `json.Marshal`. The fast path is the common case for pure-SQL queries; any post-resolution stitching or remote-schema participation forces the regular path through `json.Marshal`.

Errors are formatted by `formatGQLErrors` and `pathToAny`, preserving locations, path, and extensions from `gqlerror.Error`.

## Operation specifics

### Queries

The pipeline above is the query path verbatim.

### Mutations

Same pipeline. Two differences worth noting:

- Mutation execution against PostgreSQL uses a single transaction per `roots.BuildQuery` invocation; the driver wraps the entire operation list. See `connector/sql/postgres/postgres.go`.
- Sequential semantics — GraphQL requires same-document mutations to run in order — are enforced by the query builder, not the controller.

### Subscriptions

Subscriptions never go through HTTP `Resolve`. They arrive on the WebSocket endpoint and flow through `controller/websocket.go`'s `webSocketHandler`. The same `queryPlanner.Plan` rejects any subscription containing a remote relationship; everything else dispatches to a per-connector `subscription.Handler`. See [subscriptions.md](./subscriptions.md).

## Errors

| Stage                              | Error source                   | Shape in response                                       |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------- |
| Auth                               | Missing session                | `{"errors": [{"message": "..."}], "data": null}`        |
| Schema lookup                      | Unknown role                   | `{"errors": [...], "data": null}`                       |
| Parse / validate                   | gqlparser                      | `{"errors": [...with locations/path...], "data": null}` |
| Planner                            | Internal failure               | `{"errors": [...], "data": null}`                       |
| Pre-execution connector validation | Structured argument validation | `{"errors": [...], "data": null}`                       |
| Connector                          | One failed, others ok          | `{"errors": [...], "data": {partial}}`                  |
| Remote resolution                  | Resolver failure               | `{"errors": [...], "data": null}`                       |

The controller never returns Go errors for user-visible failures; it always produces a `*GraphQLResponse`. The only Go errors that escape `Resolve` are unrecoverable internal failures.

## Concurrency and reload

`state` is an `atomic.Pointer` (`controller/controller.go:99`). `buildState` constructs a fresh `controllerState` for each metadata reload; `swapState` swaps the pointer and then shuts down the old state's subscription handlers and connectors on a background goroutine with a 30-second timeout (`shutdownTimeout`). In-flight requests holding the old pointer keep their connectors valid because `Close()` runs only after the new state is in place; WebSocket connections listen on `state.done` to close themselves when their state is retired.

See [architecture.md](./architecture.md) for the full reload contract.

## File reference

| File                                                          | Purpose                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `controller/controller.go`                                    | `Controller`, atomic state pointer, reload loop                         |
| `controller/handlers.go`                                      | HTTP handlers; wires Gin to `Resolve`                                   |
| `controller/resolve.go`                                       | `Resolve`, parsing/validation, planning, execution orchestration        |
| `controller/remote_validation.go`                             | Pre-execution validation of database-backed remote relationship targets |
| `controller/querycache.go`                                    | Per-state LRU for parsed queries                                        |
| `controller/middleware/session.go`                            | Admin secret → JWT → public-role precedence                             |
| `controller/introspection/introspection.go`                   | `__schema` / `__type` execution                                         |
| `controller/planner/planner.go`                               | Per-connector planning, sub-operation building                          |
| `controller/planner/analyzer.go`                              | Remote-relationship detection, phantom-field spec generation            |
| `controller/planner/ast_transformer.go`                       | Relationship stripping, fragment filtering, phantom injection           |
| `controller/planner/types.go`                                 | `QueryPlan`, `PrimaryQuery`, `RemoteQueryPlan`, `PhantomFieldSpec`      |
| `controller/resolver/remote_relationship_resolver.go`         | Resolve loop, raw-result materialisation, phantom cleanup               |
| `controller/resolver/remote_query_builder.go`                 | Build `RemoteQuery` objects from plan + parent results                  |
| `controller/resolver/{database,schema,aggregate}_resolver.go` | Per-strategy resolution                                                 |
| `connector/connector.go`                                      | `Connector` interface, factory registry                                 |
| `connector/composer/`                                         | Cross-connector schema merge, per-role validation                       |
| `connector/sql/query.go`                                      | SQL `Connector.Execute` / `ValidateOperation`                           |
| `connector/sql/graphql/queries/roots.go`                      | Root-field dispatch for SQL builders                                    |
| `connector/remoteschema/connector.go`                         | Remote-schema `Connector.Execute` / `ValidateOperation`                 |
| `connector/remoteschema/execute.go`                           | `@preset` application, query string rendering, HTTP request             |

## See also

- [remote-relationships.md](./remote-relationships.md) — cross-connector resolution mechanics.
- [subscriptions.md](./subscriptions.md) — WebSocket protocol, cohorts, multiplexing.
- [remote-schemas.md](./remote-schemas.md) — SDL parsing, presets, header forwarding.
- [architecture.md](./architecture.md) — state swap, auth precedence, fast path.
