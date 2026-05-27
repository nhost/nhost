# Subscriptions

This document traces a GraphQL subscription end-to-end: WebSocket handshake, query routing, cohort batching, multiplexed polling, and tear-down. Subscriptions never go through the HTTP `Resolve` path covered in [query-execution.md](./query-execution.md). Instead they have their own pipeline that prioritises sharing work across subscribers with identical queries.

## Why cohorts

A naive implementation would spawn one polling goroutine per subscription, executing one SQL query per poll. Real workloads have many subscribers asking the same question (`subscription { messages { ... } }` is typical) — so Constellation groups them into **cohorts** and replaces N queries with a single multiplexed query that fans out per subscriber via Postgres `UNNEST`.

The trade-off: cohort membership requires the GraphQL query, variables, role, and operation name to be identical. Session variables can differ — those are bound per-subscriber inside the multiplexed query.

## End-to-end flow

```
┌────────────────────────────────────────────────────────────────────────┐
│  Client opens WebSocket → controller/handlers.go HandlerWebsocket      │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  controller/websocket/ (protocol layer)                                 │
│  • NewConnection upgrades HTTP, spawns readPump + writePump goroutines │
│  • Reads graphql-transport-ws frames, dispatches to MessageHandler     │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  controller/websocket.go webSocketHandler (per-connection state)       │
│  • Snapshots controllerState at connection time (consistent view)      │
│  • OnConnectionInit: ExtractSession (admin/JWT/public)                 │
│  • OnSubscribe: parse + validate query, route to subscription.Handler  │
│  • OnComplete / OnClose: Stop on the handler that owns the sub         │
└────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  subscription.Handler (interface in subscription/, impl per connector) │
│  • connector/sql/subscription.Handler routes by stream vs live query   │
└────────────────────────────────────────────────────────────────────────┘
            │                                              │
            ▼ (regular live-query)                         ▼ (subscription_stream)
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  cohortManager               │         │  streamCohortManager         │
│  • Key: query + role + vars  │         │  • Key adds cursor hash       │
│  • Cap 100, overflow chains  │         │  • Cohort rebuild after poll  │
│  • One poll loop per cohort  │         │  • New subs get initial-data  │
│  • SQL cached per cohort     │         │    sub-poll, then join cohort │
└──────────────────────────────┘         └──────────────────────────────┘
            │                                              │
            └────────────────────┬─────────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Driver.ExecuteMultiplexedOperation (postgres only for now)            │
│  • UNNEST($1::text[], $2::json[]) → _subs("result_id", "result_vars")  │
│  • Inner query reads session vars / cursors via JSON path operators    │
└────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Distribute results back to subscribers                                │
│  • Per-subscriber xxhash; skip send when payload unchanged             │
│  • forwardUpdates goroutine writes "next" frames to sendCh             │
│  • Backpressure: latest-wins on the 1-deep updateCh                    │
└────────────────────────────────────────────────────────────────────────┘
```

## 1. WebSocket protocol layer

`controller/websocket/` is a pure protocol handler. It implements the `graphql-transport-ws` spec, spawns read and write pump goroutines, owns the framing, and delegates everything else to the caller via the `MessageHandler` interface:

```go
type MessageHandler interface {
    OnConnectionInit(ctx, payload)        // auth / session
    OnSubscribe(ctx, id, payload)         // start a sub
    OnComplete(ctx, id)                   // stop a sub
    OnClose(ctx)                          // tear down all subs
}
```

The package owns no business logic — see `controller/websocket/doc.go` for its architecture. Pings/pongs and connection-ack frames are sent automatically; the caller only emits `next`, `error`, and `complete` frames through the shared `sendCh` channel.

## 2. Per-connection bridge

`controller/websocket.go` is the bridge between the protocol layer and the subscription system. `webSocketHandler` is constructed per connection and holds:

- `state` — a snapshot of `controllerState` taken at connection time, so every subscription on this connection sees the same schemas / connectors even if metadata reloads. The connection self-terminates if its `state.done` channel closes.
- `session` — populated by `OnConnectionInit` through `middleware.ExtractSession` (admin secret → JWT → public role precedence).
- `subs` — a `syncmap.Map[string, *subscriptionState]` keyed by subscription ID. Each entry remembers which `subscription.Handler` owns the sub so `OnComplete` / `OnClose` stop on the correct (possibly old) handler.

`OnSubscribe` does the per-subscription preflight:

```go
operation, fragments, validatedVariables, err := parseAndValidateQuery(...)
dbName := getConnectorForOperation(state, operation)
subHandler := state.subHandlers[dbName]
h.startSubscription(ctx, id, payload, subHandler, operation, fragments, validatedVariables, logger)
```

`parseAndValidateQuery` is the subscription twin of `Resolve`'s parse step — it hits the same `queryCache`, runs `gqlparser` validation, and coerces variables. Routing is the simplest possible: pick the connector that owns the first root field. Subscriptions don't fan out across connectors (the planner rejects subscriptions with remote relationships in `Controller.execute`).

`startSubscription` calls `subHandler.Start`, gets a `<-chan subscription.Update`, and spawns `forwardUpdates` to translate updates into `next`/`error` frames.

## 3. The Handler seam

The `subscription` package (top-level `subscription/types.go`) holds three pure data shapes:

- `Request` — query string + parsed `Operation` + role + variables + session variables. `NewRequest` validates that the four load-bearing fields are non-empty.
- `Update` — `{SubscriptionID, Data jsontext.Value, Error}`. `Data` is `jsontext.Value` so connectors can hand off bytes from `encoding/json/v2` without a re-marshal.
- `Handler` — the 3-method interface (`Start`, `Stop`, `Shutdown`) every connector must implement.

The package contains no behaviour. It exists so:

1. The controller can depend on a stable interface instead of a concrete connector type.
2. Future strategies (CDC, message bus) can plug in without touching the WebSocket layer.
3. There's no import cycle between controller and connector.

## 4. SQL connector handler

`connector/sql/subscription.Handler` (`connector/sql/subscription/handler.go`) routes between two managers:

```go
isStream, cursorValues, cursorColumns, err := h.detectStreamSubscription(req)
if isStream {
    return h.streamCohortMgr.addSubscription(ctx, req, cursorValues, cursorColumns, logger)
}
return h.cohortMgr.addSubscription(ctx, req, logger)
```

Detection is cheap — `QueryBuilder.IsStreamSubscription(field)` is an O(1) name check (root field ends in `_stream`). Only the stream path pays the `BuildQuery` cost, and it does so to harvest cursor metadata, not the SQL.

## 5. Cohort manager (live queries)

`cohortManager` handles subscriptions whose payload depends only on time (the underlying tables change), not on a cursor the client provides.

### Cohort key

```go
type cohortKey struct {
    queryHash     string  // xxhash of the GraphQL query string
    role          string
    operationName string
    variablesHash string  // xxhash of GraphQL variable values
}
```

Variable *values* are part of the key because `$limit: 10` and `$limit: 20` produce different SQL — they can't share a cohort. Session variables are *not* in the key — those bind per-subscriber inside the multiplexed query.

### Overflow and capacity

`maxCohortSize` is 100. `findOrCreateCohort` walks `key`, `key_overflow_1`, `key_overflow_2`, … and returns the first cohort with room, creating a new one when every existing cohort is full. Overflow cohorts have their own poll goroutines but otherwise behave identically.

### Polling loop

`pollCohort` runs under `context.Background()`, decoupled from any subscriber's request context — otherwise the first subscriber's disconnect would cancel polling for everyone. Termination flows through `c.stopChannel()`, set either by `Handler.Shutdown` or by the empty-cohort cleanup path (cohort with zero subscribers detected during a tick).

Each tick:

1. Snapshot subscriptions under the cohort lock (`getSubscriptionsCopy`).
2. Assemble subscriber inputs: ID array and per-variable-name `[]any` of values (`buildSubscriberInputs`).
3. Build SQL on first call, then reuse the cached `*core.SQLOperation` (`getOrBuildSQL`). The SQL shape is stable for a given cohort key, so this caches the entire poll execution plan.
4. Execute via `QueryExecutor.ExecuteMultiplexedQuery` (the SQL driver's `ExecuteMultiplexedOperation`).
5. Demultiplex results back to subscribers (`distributeResults`).

### Change detection

Each cohort subscription tracks `lastHash` (xxhash of the payload bytes). `distributeResults` computes the new hash, skips the send if it matches, and updates `lastHash` only when `sendUpdate` succeeds. The first poll always sends because `lastHash` starts empty.

### Backpressure

`cohortSubscription.updateCh` is a 1-deep buffered channel. `sendUpdate` tries the send; if the buffer is full it drains the stale entry and retries with the fresh one. The semantics are *latest-wins*: a slow consumer never sees stale data, but it might miss intermediate updates. This is the right default for a "current state" subscription.

`sendMu` serialises `sendUpdate` with `stop` so closing the channel never races with a concurrent send.

## 6. Stream cohort manager

Stream subscriptions (`subscription_stream`) are different: each subscriber tracks a per-cursor position (typically a sequence column or timestamp). The cohort key includes the **cursor hash** so subscribers at the same position batch together, and cohorts naturally merge as their cursors advance to a shared value.

```go
type streamCohortKey struct {
    queryHash     string
    role          string
    operationName string
    variablesHash string
    cursorHash    string  // hash of serialised cursor values
}
```

### Per-poll rebuild

After each poll, `executeAndRebuild` produces a new map of cohorts:

- Subscribers whose cursor advanced get re-keyed under their new cursor position.
- New subscribers that arrived during the poll go into a separate "initial-data" cohort to receive the catch-up payload before joining the main cohort at the current cursor.

The rebuild is what makes cohort merging emergent: as multiple cohorts' cursors advance to the same value, their subscribers end up in the same key on the next tick.

### Cursor extraction

`pickCursorFromResults` parses each result row once and reads the cursor column to advance the cohort. The earlier code re-parsed every payload three times per poll; the current single-parse path is a deliberate optimisation.

## 7. Multiplexed SQL

`connector/sql/graphql/queries/multiplexed/multiplexed.go` rewrites a single GraphQL subscription's SQL into Hasura-style multiplexed form:

```sql
SELECT "_subs"."result_id", "_fld_resp"."root" AS "result"
FROM UNNEST($1::text[], $2::json[]) AS "_subs"("result_id", "result_vars")
LEFT OUTER JOIN LATERAL (
    SELECT (... inner query with values from _subs.result_vars ...)
) AS "_fld_resp" ON ('true')
```

The inner query reads each subscriber's session variables and cursor state from `_subs.result_vars` using JSON path operators:

```sql
("_subs"."result_vars" #>> '{session,x-hasura-user-id}')::uuid
```

GraphQL `$variable` placeholders are kept as numbered placeholders (`$3`, `$4`, …) because they're identical across the cohort. Only session vars and cursor state vary per subscriber.

Multiplexing currently requires `UNNEST` + LATERAL + `::type[]` — all Postgres-only. The SQLite handler uses a different multiplexing scheme; stream subscriptions also work on SQLite but the cohort SQL shape differs.

## 8. Tear-down

| Trigger | Path |
|---|---|
| Client sends `complete` | `webSocketHandler.OnComplete` → `subscriptionState.handler.Stop(ctx, id)` |
| Client closes connection | `OnClose` → range over all subs, call `Stop` on each |
| Metadata reload | `controllerState.shutdown` closes `state.done`, all `Shutdown(ctx)` runs on every per-state handler with a 30s budget |
| Server shut down | Same as reload, with the process exit context |

When a cohort's last subscriber leaves, the next poll-tick observes `c.isEmpty()` under the manager lock, deletes the cohort entry, and closes its stop channel. This TOCTOU pattern is deliberate: checking emptiness *inside* the manager lock prevents an add-then-delete race with `addSubscription`.

`forwardUpdates` exits cleanly whenever its sub's `stopCh` closes, the connection's request context cancels, or the handler closes the update channel.

## File reference

| File | Purpose |
|---|---|
| `controller/handlers.go` | `HandlerWebsocket` entry |
| `controller/websocket/` | Pure protocol layer (read/write pumps, framing) |
| `controller/websocket.go` | Per-connection bridge, `webSocketHandler`, session extraction, sub registry |
| `subscription/types.go` | `Handler` interface, `Request`, `Update` |
| `connector/sql/subscription/handler.go` | SQL connector's `Handler`, stream/live routing |
| `connector/sql/subscription/cohort_manager.go` | Live-query cohort lifecycle, polling loop, distribute |
| `connector/sql/subscription/cohort.go` | `cohortKey`, `cohort`, `cohortSubscription`, backpressure |
| `connector/sql/subscription/stream_cohort_manager.go` | Stream cohorts, per-poll rebuild, cursor extraction |
| `connector/sql/subscription/stream_cohort.go` | `streamCohortKey`, cohort merging on cursor advance |
| `connector/sql/subscription/doc.go` | Package architecture diagram and details |
| `connector/sql/graphql/queries/multiplexed/multiplexed.go` | SQL rewrite: `UNNEST` + JSON path operators |
| `connector/sql/postgres/postgres.go` | `ExecuteMultiplexedOperation` for pgx |
| `internal/lib/syncmap/syncmap.go` | Typed concurrent map used by `webSocketHandler.subs` |

## See also

- `connector/sql/subscription/doc.go` — package-level architecture diagram with a deeper dive on multiplexed SQL.
- `controller/websocket/doc.go` — pure protocol package, goroutine model.
- [architecture.md](./architecture.md) — how the per-connection state snapshot interacts with metadata reload.
