# Architecture Notes

This document covers cross-cutting architectural choices that don't fit cleanly into the per-feature developer docs: the metadata-reload protocol, authentication precedence, the per-state query cache, the raw-bytes response fast path, and request-context plumbing.

Read [query-execution.md](./query-execution.md) first if you haven't — most of what follows is the "why" behind that pipeline.

## Atomic state swap

Constellation supports zero-downtime metadata reload. The controller holds an `atomic.Pointer[controllerState]` (`controller/controller.go:99`). Every request — HTTP or WebSocket — loads it once at entry:

```go
state := c.state.Load()
```

…and uses that snapshot for the request's lifetime. `controllerState` carries:

- `validatedSchemas` — per-role `*ast.Schema`
- `connectors` — name → `connector.Connector`
- `fieldToConnector` — root-field routing
- `metadata` — the source metadata that produced this state
- `remoteRelationshipResolver` — bound to the snapshot's connector map
- `queryPlanner` — bound to the snapshot's schemas + relationships
- `subHandlers` — per-DB subscription handlers
- `queryCache` — per-state parsed-query LRU
- `done` — closed when this state is retired

### Reload protocol

When `metadata.Source.Watch` emits a new metadata, `Controller.Run` (`controller/controller.go:372`) calls `buildState` to construct a fresh `controllerState` and then `swapState`:

```go
oldState := c.state.Swap(newState)

go func() {
    shutdownCtx, cancel := context.WithTimeout(ctx, shutdownTimeout) // 30s
    defer cancel()
    oldState.shutdown(shutdownCtx)
    oldState.closeConnectors()
}()
```

The new state goes live immediately. Old state shutdown happens on a background goroutine with a 30-second budget:

1. `close(oldState.done)` — signals every WebSocket connection holding this snapshot to wind down.
2. `Handler.Shutdown(ctx)` on every per-DB subscription handler — terminates cohort polling.
3. `Close()` on every connector — releases pgxpool, closes go-sqlite3 DB, etc.

`HandlerGet` (the WebSocket entry) wires `state.done` to `context.CancelCause(errMetadataReloaded)` so a reload propagates as a context cancellation rather than an abrupt close (`controller/handlers.go:94`).

In-flight HTTP requests have already snapshotted the old state and run to completion against it — their connector references stay valid because `Close()` runs only after the swap has happened, and their loaded pointer keeps everything reachable.

If `buildState` fails (bad metadata, unreachable remote schema, etc.) the current state stays live and the error is logged. There is no fallback to a "partially built" state.

### What this protects

- **Mid-request reload**: requests see a consistent view because every field they touch is reachable from the single `Load()`.
- **Subscriptions across reloads**: existing subscriptions on the old state continue polling against the old handler until the WebSocket closes; new subscriptions land on the new state.
- **Connector close on a busy pool**: requests that grabbed the old pool keep using it. The new state's `BuildConnectorsFromMetadata` creates fresh connectors; pgxpool teardown happens once everyone has handed back.

### What this does *not* protect

- **Request that holds the state pointer for >30s**: in theory, a long-running operation could outlive the shutdown timeout. In practice, request timeouts and the HTTP server's own shutdown handling close this.
- **Stateful subscription handlers across reload**: a stream subscription on the old handler doesn't "migrate" to the new handler — clients must reconnect.

### `NewFromConnectors`

`controller/controller.go:432` is the alternate constructor that skips metadata loading entirely. It's used for programmatic embedding, in-process tests, and benchmarks. The result still has the atomic pointer wiring; it just never reloads (`Run` is a no-op because `source == nil`).

## Authentication precedence

`middleware.ExtractSession` (`controller/middleware/session.go:81`) implements three-tier auth:

```
adminSecret matches X-Hasura-Admin-Secret  ──► admin (or X-Hasura-Role)
otherwise: JWT validates                   ──► claims-derived role
otherwise: nothing                         ──► public role
```

Properties worth knowing:

- **Admin secret wins absolutely.** Once the admin secret matches, JWT is not consulted. `X-Hasura-Role` can downshift to a non-admin role while still keeping admin's "all session variables from headers" behaviour (`extractAdminSession`).
- **No tokens means public role, not error.** A request without any credentials is treated as the `public` role with the single session variable `{"x-hasura-role": "public"}`. JWT *errors* (token present but invalid) abort with HTTP 401; *absence* of a token does not.
- **JWT failure is fatal.** If a JWT is present but `Authenticate` returns an error, the middleware short-circuits with 401. It does not fall through to public role — that would let attackers downgrade.
- **`noOpJWTAuthenticator` is the off switch.** When JWT auth is disabled at startup, the controller is constructed with `middleware.NewNoOpJWTAuthenticator()`, which returns `(nil, nil)` for every call. This makes the JWT branch fall through to public.

The middleware also stores three things on the request context:

1. The resolved `*SessionVariables` (read via `SessionFromContext`).
2. A *cloned* copy of the request headers (read via `requestcontext.ClientHeadersFromContext` for remote-schema forwarding).
3. A request-scoped slog logger with the role attached.

`requestcontext` (`internal/requestcontext/`) is the only place these keys are visible. The keys are unexported so external callers can't install wrong-typed values.

## Query cache

`controller/querycache.go` wraps `internal/lib/lru.Cache[queryCacheKey, queryCacheEntry]` in a typed alias. The cache:

- Keys on `(queryString, role)` — different roles have different schemas, so the parsed AST and validation errors are not interchangeable.
- Stores `*ast.QueryDocument` + `gqlerror.List` — invalid queries are cached too, so repeated bad requests don't re-run the validator.
- Has a fixed size of 512 entries (`defaultQueryCacheSize`); LRU eviction discards the least-recently-used entries on overflow.
- Is owned by `controllerState`. A metadata reload produces a fresh cache because the new state has a new `queryCache`. This is the simplest correctness model: schemas changed, all cached validations are stale, throw the whole cache away.

The cache is checked both by HTTP `Resolve` (`controller/resolve.go:438`) and by WebSocket `parseAndValidateQuery` (`controller/websocket.go:247`).

## Raw-bytes response fast path

SQL connectors return `jsontext.Value` (raw JSON bytes) by default rather than parsed Go maps. The controller exploits this in `buildRawResponse` (`controller/resolve.go:459`):

```go
if every value in results is jsontext.Value:
    pre-size a byte buffer
    write {"data":{ "key1": <raw1>, "key2": <raw2>, ... }}
    return as rawResponse
```

`HandlerPost` then writes `rawResponse` directly to the HTTP body — `json.Marshal` never runs. The benefit is twofold: zero re-serialisation cost, and no garbage from intermediate `map[string]any` traversal.

The fast path is **disabled** automatically when:

- Any connector returned a non-`jsontext.Value` value (the remote-schema connector returns a parsed map, for example).
- The resolver materialised raw results into Go maps via `UnmarshalRawResults` (required for `jsonpath` traversal during remote-relationship stitching).

When the fast path is off, the regular `json.Marshal` path runs over the merged `map[string]any`.

## Connector contract surface

`connector.Connector` (`connector/connector.go:24`) has four methods. The intentional smallness matters:

- `GetSchema()` — used once at composition time, not per request.
- `Execute(ctx, op, fragments, vars, role, sessionVars, logger)` — the request path. Operations arrive cleaned by the planner.
- `GetTypeName(identifier)` — used by the composer and resolver for cross-connector type resolution.
- `Close()` — called once when the controller state is retired.

No `GetRelationships`, no `ProcessRemoteRelationships`, no `ExecuteResult`. All cross-connector reasoning is in `controller/planner` and `controller/resolver`; connectors are deliberately simple.

Capability hints (subscription support, grouped-aggregate support) are advertised through optional Go interfaces detected by type assertion, not by adding methods to `Connector`:

- `subscriptionCapableConnector` — adds `NewSubscriptionHandler`. The controller probes via type assertion in `buildState` (`controller/controller.go:161`).
- `groupedaggregate.Executor` — used by the resolver's aggregate path (`controller/resolver/aggregate_resolver.go:60`).

Adding a new optional capability follows the same pattern: declare an interface in the consumer package, implement it on the relevant connectors, type-assert at the call site.

## Error response shape

The controller never returns Go errors for user-visible failures from `Resolve`. The contract is:

- A `*GraphQLResponse` is always produced, even for parse / validation / planner errors.
- Go errors are reserved for unrecoverable internal failures that warrant a 500.
- Connector errors are caught in `executeConnectors` and packed into the response's `Errors` field. Partial data from other connectors is preserved.
- Remote-schema errors with the `*remoteschema.GraphQLError` shape have their structured errors (`message`, `locations`, `path`, `extensions`) flattened into the response.

The HTTP handler maps:

- Parsing failure on the request body → 400.
- Internal `Resolve` error → 500.
- Everything else → 200 with `{data, errors}` shape.

## Concurrency model summary

| Component | Mutation model |
|---|---|
| `Controller.state` | Atomic pointer swap on metadata reload |
| `controllerState.queryCache` | Internal `sync.Mutex` (the LRU is concurrency-safe) |
| `cohortManager.cohorts` | `sync.RWMutex` on the map; cohort polling under `context.Background()` |
| `cohort.subscriptions` | `sync.RWMutex` on the map; per-subscription `sendMu` serialises send vs stop |
| `webSocketHandler.subs` | `syncmap.Map[string, *subscriptionState]` |
| `connector/sql` connectors | Driver-internal pooling; `Execute` is safe to call concurrently |
| `connector/remoteschema` | Stateless beyond `httpClient`; safe to call concurrently |

The hot path is therefore lock-free for steady-state reads (atomic pointer load), and only takes locks for short maps inside cohorts / sub registries. No request-path code blocks on metadata reload.

## File reference

| File | Concern |
|---|---|
| `controller/controller.go` | Atomic state pointer, `buildState`, `swapState`, `Run`, `NewFromConnectors` |
| `controller/handlers.go` | HTTP and WebSocket entry, raw-bytes write |
| `controller/resolve.go` | Pipeline, fast-path detection (`buildRawResponse`) |
| `controller/querycache.go` | Per-state LRU type alias |
| `controller/middleware/session.go` | Auth precedence, session context plumbing |
| `controller/errors.go` | Standard error responses |
| `internal/requestcontext/context.go` | Request-scoped context keys |
| `internal/lib/lru/lru.go` | Generic LRU implementation |
| `internal/lib/syncmap/syncmap.go` | Typed concurrent map |

## See also

- [query-execution.md](./query-execution.md) — full request pipeline.
- [subscriptions.md](./subscriptions.md) — how state snapshots interact with long-lived WebSocket subs.
- [remote-relationships.md](./remote-relationships.md) — planner/resolver responsibility split.
- [remote-schemas.md](./remote-schemas.md) — header forwarding, SDL parsing, preset application.
- [customization.md](./customization.md) — schema customization decorator (namespacing, type/field renaming) and how it's reversed on the execution path.
