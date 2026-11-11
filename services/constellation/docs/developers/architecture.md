# Architecture Notes

This document covers cross-cutting architectural choices that don't fit cleanly into the per-feature developer docs: the metadata-reload protocol, authentication precedence, the per-state query cache, the raw-bytes response fast path, and request-context plumbing.

Read [query-execution.md](./query-execution.md) first if you haven't — most of what follows is the "why" behind that pipeline.

## Atomic state swap

Constellation supports metadata reload without making new requests wait for the old state to drain. The controller holds an `atomic.Pointer[controllerState]` in `controller/controller.go`. HTTP `Resolve` acquires its snapshot with a lifetime registration:

```go
state, release := c.acquireState()
defer release()
```

`acquireState` loads the pointer, increments that state's `inflight` counter, then rechecks the pointer. If a swap intervened, it undoes the registration and retries before using the state. This prevents a request from starting work on a retired state whose connectors may already be closing. `Resolve` keeps the successful registration throughout schema selection, parsing, validation, connector execution, and remote-relationship resolution; the deferred release covers every return path.

WebSocket `HandlerGet` still takes a connection-wide snapshot with `state := c.state.Load()` and listens on `state.done` for retirement. WebSockets do not register in the HTTP counter.

`controllerState` carries:

- `validatedSchemas` — per-role `*ast.Schema`
- `connectors` — name → `connector.Connector`
- `fieldToConnector` — root-field routing
- `metadata` — the source metadata that produced this state
- `remoteRelationshipResolver` — bound to the snapshot's connector map
- `queryPlanner` — bound to the snapshot's schemas + relationships
- `subHandlers` — per-DB subscription handlers
- `queryCache` — per-state parsed-query LRU
- `done` — closed when this state is retired
- `inflight` — atomic count of HTTP calls registered through `acquireState`, distinct from the query cache's singleflight loads

All published `controllerState` configuration fields, including schemas, connectors, routing, metadata, the planner/resolver, subscription handler maps, and inconsistencies, must be rebuilt through `buildState` — never mutate the published snapshot in place. Only synchronized lifecycle state (`done`/`inflight`) and query-cache internals are exempt from that immutable-snapshot contract; cached ASTs and errors remain read-only.

### Reload protocol

When `metadata.Source.Watch` emits new metadata, `Controller.Run` calls `buildState` to construct a fresh `controllerState` and then `swapState`. The teardown excerpt is:

```go
oldState := c.state.Swap(newState)

go func() {
    shutdownCtx, cancel := context.WithTimeout(ctx, shutdownTimeout) // 30s
    defer cancel()

    drainCtx, drainCancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
    defer drainCancel()

    oldState.shutdown(shutdownCtx)
    oldState.waitIdle(drainCtx)
    oldState.closeConnectors()
}()
```

The new state goes live immediately. The background goroutine retires the old state in order:

1. `close(oldState.done)` — signals every WebSocket connection holding this snapshot to wind down.
2. `Handler.Shutdown(shutdownCtx)` on every per-DB subscription handler — stops subscriptions, with a context that still responds to controller cancellation and has a `shutdownTimeout` deadline.
3. `waitIdle(drainCtx)` — waits for registered HTTP calls to release the old state, or for the detached 30-second drain deadline to expire. Controller cancellation cannot cut this wait short, even for a state already replaced by a reload.
4. `Close()` on every connector — releases pgxpool, closes go-sqlite3 DB, etc.

Both timeout contexts are created before subscription shutdown, so HTTP draining uses the remaining drain budget rather than starting a fresh 30 seconds afterward. The deadline bounds the HTTP wait, not the duration of connector `Close()` calls or the entire teardown.

`HandlerGet` wires `state.done` to the connection's `context.WithCancelCause` cancel function with `errMetadataReloaded`, so retirement propagates as context cancellation (`controller/handlers.go`). Subscriptions are shut down rather than migrated to the new state.

Registered HTTP calls can finish against the old connectors before the drain deadline. Holding a state pointer alone only keeps Go objects reachable: it does not prevent `Close()` from invalidating a pgx pool or another connector resource. The `inflight` registration and `waitIdle`, not the pointer swap itself, delay connector closure.

If `buildState` cannot produce a usable state, the current state stays live and the error is logged. Per-source or per-role failures can instead yield a usable snapshot with metadata inconsistencies; that snapshot is published normally.

### Controller exit

`Run` consumes updates until the source's watch channel closes. Its deferred `shutdownState` synchronously signals the current state's `done`, shuts down subscriptions with the supplied `ctx`, waits on `inflight`, then closes the current connectors. As on reload, its HTTP drain uses `context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)`, created before subscription shutdown, so even an already-cancelled controller context leaves a bounded drain opportunity.

`Run` does not return until this current-state teardown finishes; the HTTP wait can consume the 30-second drain budget, and subscription shutdown and connector closure are not given an overall timeout by `shutdownState`. It does not join background teardown goroutines for previously replaced states. Nor does it stop HTTP admission or wait for all HTTP-server handlers: registration begins inside `Resolve`, after body parsing, and ends before the HTTP response is written.

### What this protects

- **Mid-request reload**: each `Resolve` uses one successfully registered snapshot, so its schemas, routing, and connectors remain consistent.
- **Subscriptions across reloads**: `state.done` cancels connections using the old snapshot and subscription shutdown stops their handlers; new connections use the new state.
- **Connector close during registered HTTP work**: connector teardown waits for registrations to reach zero, subject to the drain deadline. The new state's `BuildConnectorsFromMetadata` creates fresh connectors.

### What this does *not* protect

- **Work outliving the drain deadline**: connectors are closed after `waitIdle` returns even if registrations remain. A state pointer does not extend the resource lifetime beyond that deadline.
- **The whole HTTP-server lifecycle**: handlers outside `Resolve` are not counted, and controller teardown does not prevent new requests from entering. This is not an HTTP-server graceful-shutdown guarantee.
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

`controller/querycache.go` owns an `internal/lib/lru.Cache[queryCacheKey, queryCacheEntry]` and a `singleflight.Group` for in-flight loads. The cache:

- Keys on `(queryString, role)` — different roles have different schemas, so the parsed AST and validation errors are not interchangeable.
- Stores `*ast.QueryDocument` + `gqlerror.List` — invalid queries are cached too, so repeated bad requests don't re-run the validator.
- Has a fixed size of 512 entries (`defaultQueryCacheSize`); LRU eviction discards the least-recently-used entries on overflow.
- Coalesces overlapping misses for the same key through `golang.org/x/sync/singleflight`. The callback rechecks the LRU before parsing and publishes the document and validation errors as one typed result; singleflight owns waiter coordination and cleanup. A length-prefixed role followed by the query makes the string key unambiguous even with embedded separators or NUL bytes. Different keys can load concurrently; warm hits return directly from the LRU before constructing a singleflight key or calling the miss wrapper.
- Is owned by `controllerState`, including its in-flight loads. A metadata reload produces a fresh cache because the new state has a new `queryCache`; requests against the old state cannot populate or join the new state's cache.

HTTP `Resolve` and WebSocket `parseAndValidateQuery` both use `loadQuery` in `controller/querycache.go`. Shared documents and errors are read-only: operation selection, variable coercion, directive pruning, permissions, and execution remain request-specific.

The query-cache tests cover deterministic concurrent misses, shared errors, panic recovery and retry, role/state isolation, key-encoding collisions, and the direct warm-hit path. `BenchmarkLoadQueryRealistic` exercises generated table schemas, filters, nested relationships, and fragments with bursts up to 512 requests across 16 distinct queries. Run the cache benchmarks from the repository root with `GOEXPERIMENT=jsonv2 go test ./services/constellation/controller -run '^$' -bench '^BenchmarkLoadQuery' -benchmem`.

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

`connector.Connector` (`connector/connector.go:24`) has five methods. The intentional smallness matters:

- `GetSchema()` — used once at composition time, not per request.
- `Execute(ctx, op, fragments, vars, role, sessionVars, logger)` — the request path. Operations arrive cleaned by the planner.
- `ValidateOperation(op, fragments, vars, role, sessionVars)` — the side-effect-free pre-execution check. When a request fans out to multiple root connectors, or when the plan contains remote relationship work, the controller runs this pass before executing any root connector; for database-backed remote relationships it also validates the planned target operation or grouped-aggregate request. A structured argument-validation failure rejects the whole request with no partial data and no sibling mutation side effects. Plain single-connector requests skip the extra pass because `Execute` already performs the same local build/validation before touching the backend. Connectors without useful local preflight, such as remote schemas and the in-memory connector, return nil and report failures from `Execute` instead.
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
- Structured argument errors reported by `ValidateOperation` in the pre-execution pass produce an `Errors` response with `Data: nil` before any connector executes.
- Connector errors from `Execute` are caught in `executeConnectors` and packed into the response's `Errors` field. Partial data from other connectors is preserved.
- Remote-schema errors with the `*remoteschema.GraphQLError` shape have their structured errors (`message`, `locations`, `path`, `extensions`) flattened into the response.

The HTTP handler maps:

- Request body over the configured cap → 413.
- Parsing failure on the request body → 400.
- Internal `Resolve` error → 500.
- Everything else → 200 with `{data, errors}` shape.

## Concurrency model summary

| Component | Mutation model |
|---|---|
| `Controller.state` | Atomic pointer swap on metadata reload |
| `controllerState.inflight` | Atomic registration/release counter for HTTP state acquisition; teardown polls it until idle or the drain deadline |
| `controllerState.queryCache` | LRU internal `sync.Mutex` for completed entries; per-state `singleflight.Group` makes concurrent cold misses for the same role/query wait for one shared parse and validation result (a leader panic re-panics in waiters); warm hits bypass singleflight |
| `cohortManager.cohorts` | `sync.RWMutex` on the map; cohort polling under `context.Background()` |
| `cohort.subscriptions` | `sync.RWMutex` on the map; per-subscription `sendMu` serialises send vs stop |
| `webSocketHandler.subs` | `syncmap.Map[string, *subscriptionState]` |
| `connector/sql` connectors | Driver-internal pooling; `Execute` is safe to call concurrently |
| `connector/remoteschema` | Stateless beyond `httpClient`; safe to call concurrently |

HTTP state acquisition uses atomic pointer loads and a per-state atomic registration counter; WebSocket snapshots use an atomic pointer load. Warm query-cache hits take the LRU mutex and concurrent cold misses for the same role/query in one state wait for one in-flight parse and validation. Cohort and subscription registries use short map locks. No request-path code blocks on metadata reload.

## File reference

| File | Concern |
|---|---|
| `controller/controller.go` | Atomic state pointer, `buildState`, `swapState`, `Run`, `NewFromConnectors` |
| `controller/handlers.go` | HTTP and WebSocket entry, raw-bytes write |
| `controller/resolve.go` | Pipeline, fast-path detection (`buildRawResponse`) |
| `controller/querycache.go` | Per-state parsed/validated-query LRU and concurrent miss coalescing |
| `controller/middleware/session.go` | Auth precedence, session context plumbing |
| `controller/errors.go` | Standard error responses |
| `internal/requestcontext/context.go` | Request-scoped context keys |
| `internal/lib/lru/lru.go` | Generic LRU implementation |
| `github.com/nhost/nhost/internal/lib/syncmap` (repo root, not under constellation's `internal/`) | Typed concurrent map |

## See also

- [query-execution.md](./query-execution.md) — full request pipeline.
- [subscriptions.md](./subscriptions.md) — how state snapshots interact with long-lived WebSocket subs.
- [remote-relationships.md](./remote-relationships.md) — planner/resolver responsibility split.
- [remote-schemas.md](./remote-schemas.md) — header forwarding, SDL parsing, preset application.
- [customization.md](./customization.md) — schema customization decorator (namespacing, type/field renaming) and how it's reversed on the execution path.
