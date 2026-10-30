# Remote Relationships

This document explains how Constellation resolves GraphQL relationships that cross connector boundaries — database↔database, database↔remote-schema, and remote-schema↔database joins. The companion documents to read first are [query-execution.md](./query-execution.md) (the surrounding pipeline) and the godoc on `controller/planner` and `controller/resolver`.

## Supported relationship kinds

| Kind | Source | Target | Resolver strategy |
|---|---|---|---|
| **db→db** | SQL DB | Different SQL DB | `DatabaseResolver` (WHERE col IN) |
| **db→rs** | SQL DB | Remote GraphQL schema | `SchemaResolver` (aliased fields) |
| **rs→db** | Remote schema | SQL DB | `DatabaseResolver` |
| **rs→rs** | Remote schema | Remote schema | **not supported** |
| **db→db (aggregate)** | SQL DB | Different SQL DB | `groupedaggregate.Executor` (no resolver) |

Same-database relationships ("local" object/array relationships) never reach the planner — they are compiled into a single SQL statement by `connector/sql/graphql/queries`. The planner only fires when a relationship crosses connectors.

## Metadata configuration

Relationships are defined in Hasura-style YAML metadata, parsed into native shapes by `metadata/convert.go`.

**db→db (`to_source`)**

```yaml
remote_relationships:
  - name: user
    definition:
      to_source:
        source: auth_db
        table: { schema: auth, name: users }
        field_mapping: { user_id: id }   # local_col: remote_col
        relationship_type: object         # or "array"
```

**db→rs (`to_remote_schema`)**

```yaml
remote_relationships:
  - name: inventory
    definition:
      to_remote_schema:
        remote_schema: inventory_service
        lhs_fields: [product_id]
        remote_field:
          getProduct:
            arguments:
              id: $product_id            # $-prefix = source field reference
```

**rs→db** (in `remote_schemas.yaml`, on a remote schema type)

```yaml
remote_relationships:
  - type_name: ExternalUser
    name: local_profile
    definition:
      to_source:
        source: default
        table: { schema: public, name: profiles }
        field_mapping: { userId: user_id }   # remote_field: local_col
        relationship_type: object
```

Metadata loading produces `metadata.ObjectRelationship` / `ArrayRelationship` / `RemoteRelationship` values which the controller then lowers into `planner.RelationshipMetadata` during state construction (`controller/controller.go:buildPlannerRelationships`).

## Where the work happens

The remote-relationship system runs across three layers.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Controller (controller/controller.go)                               │
│  • buildPlannerRelationships: flattens metadata → []*RelationshipMetadata │
│  • Owns the QueryPlanner and RemoteRelationshipResolver per state    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  QueryPlanner (controller/planner/*)                                 │
│  • Analyzer: detects remote relationships, collects phantom columns  │
│  • ASTTransformer: strips relationship fields, filters fragments     │
│  • injectPhantomFields: mutates the CleanOperation                   │
│  • Output: QueryPlan { PrimaryQueries, RemoteQueries }               │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Connectors (sql, remoteschema)                                      │
│  • Connector.Execute receives the planner's CleanOperation           │
│  • Connectors are unaware of cross-connector relationships at runtime│
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Resolver (controller/resolver/*)                                    │
│  • ResolvePlanned: build after parent stitch, execute, clean up       │
│  • Per-strategy DatabaseResolver / SchemaResolver / AggregateInfo    │
└──────────────────────────────────────────────────────────────────────┘
```

The key architectural choice is that **connectors do not detect remote relationships**. The planner produces a clean per-connector operation; the connector executes that operation exactly as it would for a single-source query. All cross-connector reasoning lives in `controller/planner` (compile-time) and `controller/resolver` (run-time).

## Planning phase

`QueryPlanner.Plan` (`controller/planner/planner.go:51`) processes one root-field group at a time:

```go
analyzer := newAnalyzer(connectorName, schema, relationships, operation.Operation, fragments)
subOp := BuildSubOperation(operation, fields)
analysis := analyzer.analyzeOperation(subOp) // analyzer sees role-visible relationships on all connectors

transformer := transform.NewTransformer(
    schema,
    toRemoteRelationships(relationships),
    connectorName,
    p.typeToConnectors,
)
transformResult := transformer.Transform(subOp, fragments)

// Inject only source phantoms for the primary operation. Each remote
// result's selection gets its own child join-key phantoms on a copied AST.
transform.InjectPhantomFields(
    transformResult.CleanOperation, toPhantomSpecs(primaryPhantoms), schema, transformResult.CleanFragments,
)

plan.PrimaryQueries = append(plan.PrimaryQueries, &PrimaryQuery{...})
plan.RemoteQueries = append(plan.RemoteQueries, analysis.RemoteQueries...)
```

The transformer receives `p.typeToConnectors` (`map[string][]string`) so structurally identical object types can remain associated with every connector that owns them.

### Analyzer

`controller/planner/analyzer.go` recursively walks the selection set keeping track of the current `typeName` and `jsonpath.Path`. For each field whose `(typeName, fieldName)` matches a `RelationshipMetadata` with `IsRemote=true` it:

- Adds the join columns from `JoinMapping` to a phantom set (`neededPhantoms`). Compatible duplicate relationship selections at one response path are merged before target execution, so their field sets are unioned and only one batched target call occurs.
- Builds a `RemoteQueryPlan` capturing the source path, target connector, output alias, the user's `Selection`, and whether the resolver strategy is database or schema (`ResolverKindSchema` when `RemoteFieldPath` is non-empty).
- Continues through both local fields and remote results. The target connector's role-visible relationships are included in the lookup, and each child plan's source path traverses its parent's response key (including aliases and arrays).

The analyzer expands `*ast.FragmentSpread` and `*ast.InlineFragment` so relationships defined on fragment-targeted types are caught. Relationship lookup is scoped by the connector owning each source result, including when different connectors share a composed type name. Spread-site `@skip`/`@include` is evaluated with this request's coerced variables before merging, without mutating cached fragments.

### Phantom field specification

After detecting relationships, the analyzer compares `neededPhantoms` against fields already selected with their own response key on the relationship's source type (`collectOwnResponseKeyFieldsForType`). Aliased user fields still occupy response keys, so `collectResponseKeysFromSelections` reserves keys across every branch at that response path before choosing an internal alias; cleanup must not delete another branch's explicit field. The remaining fields are recorded as a `PhantomFieldSpec`:

```go
type PhantomFieldSpec struct {
    Path            jsonpath.Path     // e.g. ["users", "profile"]
    SourceType      string            // relationship's source object type
    Fields          []string          // e.g. ["department_id"]
    Aliases         map[string]string // optional internal response keys for colliding phantoms
    ForRelationship string
}
```

The spec is referenced from every `RemoteQueryPlan` that shares the same source path **and source type**, so the resolver can later look up which phantom fields belong to which relationship and which internal response key to read for aliased phantoms.

### AST transformer

`controller/planner/transform/transform.go` walks the same sub-operation, producing a deep-cloned `CleanOperation` and `CleanFragments`:

- **Strips** any field whose `(typeName, fieldName)` is a remote relationship.
- **Filters** fragments whose `TypeCondition` is not owned by `t.connectorName` (that is, `t.connectorName` is not in `t.typeToConnectors[typeName]`). Because `typeToConnectors` is a `map[string][]string`, fragments on shared types are preserved for every connector that owns the type.
- **Drops** fragment spreads that reference fragments which were filtered out or became empty after stripping. Empty fragments can transitively empty named wrappers even when the wrapper appeared earlier in the document; repeat pruning until no more definitions vanish before injecting path-local phantoms.

Because the transformer always returns a fresh AST, callers can mutate the result without affecting the planner's shared trees.

### Phantom injection

`transform.InjectPhantomFields` mutates the *clean* primary operation in place to add each primary join key at its source path only within selections compatible with the relationship's source object type. When stripping the relationship empties an inline or named fragment under a union/interface-typed field, injection restores a source-typed inline fragment with the join key. It inlines a path-local copy when descending through a named fragment, preserving type conditions and directives; changing the shared definition would expose a hidden key through other spreads that have no cleanup spec. `prepareRemoteSelection` copies remote-result selections, expands referenced fragments into inline fragments, strips child remote fields only on their source type, and injects their phantoms under that type (using a source-typed inline fragment for union/interface results). The two operations therefore each request only the keys available from their own connector and source type.

## Runtime phase

After connectors return, `Controller.resolveRemoteRelationships` (`controller/resolve.go:353`) runs the resolver pipeline.

### 1. Materialise raw JSON

SQL connectors return `jsontext.Value` (raw JSON) by default for the response fast path. The resolver needs map traversal, so `controller.unmarshalRawResults` (`controller/results.go`) materialises them into nested `map[string]any` / `[]any` values once.

### 2. Build `RemoteQuery` objects

`buildRemoteQueryFromPlan` (`controller/resolver/remote_query_builder.go`) is invoked once per plan in dependency order after any parent has been stitched. The legacy `BuildRemoteQueriesFromPlan` eager constructor remains for compatibility and isolated strategy tests; production uses `ResolvePlanned`:

1. Calls `extractJoinArgumentsFromPlan` to walk the source path with `jsonpath.Path.ToRows`, collecting every parent row.
2. Builds unique `RemoteJoinArgument` values, hashed by `(sourceColumns sorted, joined with "|")`. Rows with any null source value are skipped (no join target).
3. Selects the resolver strategy:
   - `IsArrayAggregate` plans bypass `Resolver` entirely and carry an `AggregateInfo` payload.
   - `ResolverKindSchema` plans get a `SchemaResolver`.
   - Everything else gets a `DatabaseResolver`: `Connector.GetTypeName(schema.table)` supplies the **native** target SQL root for execution. Composer/planner use the separately mapped published type name for role SDL and relationships; resolver looks up JSON target-column types under that published name.
4. Returns the pending `RemoteQuery` for the available parent rows.

Plans with parent rows but only null join values still produce a `RemoteQuery` with zero `JoinArguments`. The resolver skips target execution but stitches an explicit null field onto every parent; a plan with no parent rows needs no query.

### 3. Execute and stitch

`RemoteRelationshipResolver.ResolvePlanned` (`controller/resolver/remote_relationship_resolver.go`):

```go
for _, plan := range plansInDependencyOrder {
    rq := buildRemoteQueryFromPlan(results, plan, fragments, resolveTypeName)
    if rq != nil { r.executeAndStitch(ctx, results, rq, fragments, variables, role, sessionVariables, logger) }
}
r.removeAllLocalPhantomFields(results, pendingQueries)
```

`executeAndStitch` fills explicit null fields and makes no target call when there are no non-null join arguments. Otherwise it does five things:

1. **Aggregate fast path** — if `rq.AggregateInfo != nil`, dispatch directly to the target connector's `groupedaggregate.Executor`. See ["Cross-DB grouped aggregates"](#aggregateinfo-no-resolver--cross-db-grouped-aggregates) below.
2. **Build the remote operation** via `rq.Resolver.BuildOperation(rq)`.
3. **Resolve variable references** in per-request copies of the remote operation's arguments and referenced fragment selections (`resolveVariableReferences`). The remote operation is a standalone query with no variable definitions, so `$stats`-style references must be substituted with literal values. Never write substitutions into the cached client AST: subsequent requests with the same query text and role may use different variables or sessions.
4. **Filter fragments** down to only those the remote operation references (`collectReferencedFragments`). Other fragments may carry types that exist only on the source schema.
5. **Execute** against the target connector, then `ExtractResults` → `BuildResultLookup` → `stitchResults`. Remove target join-column phantoms only from this query's own result maps, not by response path: another selection at the same path may explicitly select that column.

The controller uses `ResolvePlanned` to materialize each pending join only after its parent has been stitched. Each relationship still batches all rows at its path; a null or denied parent cannot trigger a descendant query. Remote-result selections are copied, stripped of nested remote fields, and given the child join-key phantoms before the target connector executes. After all queries finish, local and child-key phantoms are removed by source path; target join-column phantoms were already removed from each query's own results.

### 4. Final cleanup

Only local and child-key phantom cleanup waits until all descendants finish, including all-null batches. Target join-column phantoms are removed from each query's own results immediately after stitching; child source keys were selected separately by the planner, and the final response leaks neither kind.

## Resolver strategies

### DatabaseResolver — db→db, rs→db

`controller/resolver/database_resolver.go` builds a single GraphQL operation against the target SQL connector with a `WHERE _in` filter on the join columns:

```graphql
query {
  users(where: { id: { _in: ["u1", "u2"] } }) {
    id
    displayName
  }
}
```

It also includes the target join column in the selection set as a phantom if the user didn't request it. `BuildResultLookup` then keys by the sorted join-column values, and `stitchResults` walks the source rows and writes the matching results in place. Arrays with `limit`, `offset` or `distinct_on` and more than one distinct key instead run one grouped collection query (`collection_resolver.go`, `root_query_grouped_collection.go`). That query applies the modifiers per parent key under the caller's role; SQLite batches keys in bounded chunks.

When the user aliased the join column (`userId: id`), `buildColumnAliasMap` records the alias so the lookup uses it instead of the original column name. For a computed-key join, the composer exposes the relationship only when every target mapping names a column in the role's `<type>_select_column` enum; relationships and computed fields do not qualify.

### SchemaResolver — db→rs

`controller/resolver/schema_resolver.go` cannot use `WHERE _in` because remote schemas don't have one. Instead it issues one aliased field per unique join argument:

```graphql
query {
  _0: getProduct(id: "p1") { name price }
  _1: getProduct(id: "p2") { name price }
}
```

`buildRemoteFieldFromPathRecursive` walks the `RemoteFieldPath` from metadata to produce the nested call shape. `$field` argument values are substituted with parent values from the current `RemoteJoinArgument`.

`ExtractResults` picks each aliased result back out by index, and `BuildResultLookup` keys by the sorted `LHSFields` so `stitchResults` can match parents.

### AggregateInfo (no resolver) — cross-DB grouped aggregates

When a db→db array relationship exposes its `_aggregate` sibling field (e.g. `posts_aggregate` on `User`), the planner emits a separate `RemoteQueryPlan` with `IsArrayAggregate=true`. Production's `buildRemoteQueryFromPlan` leaves the resolver unset and produces a query whose `aggregateInfo` carries the target table identity and join mapping. `BuildRemoteQueriesFromPlan` retains the old eager-build behavior for compatibility only.

`executeAndStitchAggregate` (`controller/resolver/aggregate_resolver.go:31`) then:

1. Picks the single join column (currently only single-column joins are supported; `resolver.ErrAggregateMultiColumnJoinUnsupported`).
2. Type-asserts the target connector to `groupedaggregate.Executor`. This is implemented only by SQL connectors; if the target is a remote schema the call fails with `errAggregateConnectorNotSupported`.
3. Reads the target column type from the role schema, falling back to the admin schema (for the type only) when a physical-key target column is hidden from the role. JSONB keys are bound as canonical JSON and matched with typed keys. It then invokes `ExecuteGroupedAggregate`.
4. Writes the per-key aggregate result into each parent row. Parents whose join key is null (SQL NULL or JSONB literal null) receive explicit null even though the aggregate is NON_NULL in SDL. Non-null keys with no entry receive a zero-valued `{aggregate: {...}, nodes: []}` shaped to match the user's selection.

Mutations that select an aggregate join that cannot run (a multi-column mapping or a grouped-builder failure) are rejected before any write. The SQL builder (`connector/sql/graphql/queries/root_query_grouped_aggregate.go`) resolves the mapping as an SQL column name. It fails with `ErrAmbiguousGroupedAggregateJoinColumn` if that name is also the GraphQL name of a different column, so the computed-key target-column gate cannot be bypassed. The executor adapter is in `connector/groupedaggregate/`.

## Phantom fields in detail

Two kinds of phantom column exist, and they have different lifetimes:

| Phantom kind | Added by | Path | Removed by |
|---|---|---|---|
| **Local (source-side)** | Planner via `injectPhantomFields` before connector execution | `PhantomFieldSpec.Path` on the source result | `RemoteRelationshipResolver.removeAllLocalPhantomFields` after all remote queries finish |
| **Remote (target-side)** | Resolver via `DatabaseResolver.BuildOperation` (added to `rq.RemotePhantomFields`) | Top of each result row from the remote connector | Resolver on that query's own result maps immediately after stitching |

Local phantom cleanup also runs for an all-null batch: the relationship field is stitched as null before its source key is deleted.

## Join-key deduplication

At plan time `buildJoinArguments` sorts the source/LHS columns and deduplicates their values. The database resolver builds target lookups with the same sorted columns and a type-aware key: JSONB objects and arrays have canonical JSON keys, JSON strings remain distinct from JSON numbers, and non-JSON scalar values retain cross-scalar ID matching. The grouped-aggregate executor and stitcher share `groupedaggregate.JoinKey` for JSONB targets. Sorting keeps map iteration order from changing composite keys.

Rows with any null join-key value do not execute a target join. Stitching still writes explicit null onto that parent's object, array or aggregate relationship field. A non-null key with no target rows instead yields an object null, an empty array, or an empty aggregate. For `to_remote_schema`, an all-null LHS also gets an explicit null without a target request.

## Nested paths and array navigation

Remote relationships can sit at any depth, including inside arrays:

```graphql
query {
  games {
    homeTeam {
      department { name }   # rs→db relationship on Team
    }
  }
}
```

Path navigation through `internal/jsonpath` handles both objects and arrays transparently:

- `Path.ToRows(results)` flattens arrays during traversal, returning every map at the target path. It's how join arguments are collected.
- `Path.ForEach(results, fn)` invokes `fn` for every map at the target path. It's how `stitchResults` writes results back.
- `Path.Delete(results, fields...)` removes keys from every map at the path. It's how phantom-field cleanup works.

A path like `games.homeTeam` therefore "fans out" across all games' homeTeam maps without any special-case array handling in the resolver.

## Limitations

1. **No remote relationships in subscriptions.** Subscription roots share row types with queries, but `webSocketHandler.OnSubscribe` (and the HTTP `Controller.resolveData` path) reject operations with remote relationships before polling. Queries and PostgreSQL mutation `returning` support them.
2. **rs→rs not supported.** `buildRSRelationships` only consumes `to_source` definitions on remote-schema metadata.
3. **Aggregate joins must be single-column.** Multi-column aggregate joins return `resolver.ErrAggregateMultiColumnJoinUnsupported`.
4. **Aggregate targets must be SQL connectors.** Remote schemas don't expose `groupedaggregate.Executor`.
5. **Null keys do not execute target queries.** Plans with all-null parent keys still stitch explicit null for object, array and aggregate fields; for mixed batches only non-null keys execute. This matches Hasura's `to_source` response even though its array/aggregate SDL fields are `NON_NULL`.

## Adding a new relationship strategy

To add a fifth resolver (say, "REST endpoint as remote"):

1. **Metadata** — extend `metadata/table.go` and `metadata/convert.go` so the new definition parses into `RelationshipUsing.ManualConfiguration`.
2. **RelationshipMetadata** — extend `controller/controller.go:buildDBRelMetadata` (or `buildRSRelationships`) to populate the new identifier fields and set `IsRemote=true`.
3. **Planner kind** — if the new strategy needs distinct handling, add a `ResolverKind` and route in `analyzer.buildRemoteQueryPlan`.
4. **Resolver** — implement `RemoteQueryResolver` (`BuildOperation`, `ExtractResults`, `BuildResultLookup`, `GetJoinKeyFromParent`) in `controller/resolver/`. Each method gets a `*RemoteQuery` and works on its `JoinArguments` / `SourceField`.
5. **Builder** — extend `controller/resolver/remote_query_builder.go:buildRemoteQueryFromPlan` to select the new resolver based on `ResolverType`.
6. **Tests** — add black-box tests in `controller/resolver/`, then integration tests in `integration/`.

`AggregateInfo` is the precedent for a strategy that bypasses the resolver interface entirely — copy that pattern when the new strategy can't fit the four-method contract.

## File reference

| File | Purpose |
|---|---|
| `metadata/table.go` | Parses `remote_relationships:` blocks |
| `metadata/remote_schema.go` | Parses `remote_relationships:` on remote schemas (`to_source` only) |
| `metadata/convert.go` | Lowers Hasura YAML to native types |
| `controller/controller.go` | `buildPlannerRelationships`, `buildDBRelMetadata`, `buildRSRelationships` |
| `controller/planner/planner.go` | Per-connector planning loop |
| `controller/planner/analyzer.go` | Remote-relationship detection, phantom-field collection |
| `controller/planner/ast_transformer.go` | Field stripping, fragment filtering, phantom injection |
| `controller/planner/types.go` | `QueryPlan`, `RemoteQueryPlan`, `RelationshipMetadata`, `PhantomFieldSpec` |
| `controller/resolver/remote_query_builder.go` | Production `buildRemoteQueryFromPlan`, join-argument extraction; eager compatibility builder |
| `controller/resolver/remote_relationship_resolver.go` | Production `ResolvePlanned` dependency-ordered loop, per-result and final phantom cleanup; compatibility `Resolve` |
| `controller/resolver/remote_query.go` | `RemoteQuery`, `RemoteQueryResolver`, stitching |
| `controller/resolver/database_resolver.go` | db→db, rs→db (WHERE _in); paginated arrays use `collection_resolver.go` and target-side `root_query_grouped_collection.go` |
| `controller/resolver/schema_resolver.go` | db→rs (aliased fields) |
| `controller/resolver/aggregate_resolver.go` | Cross-DB grouped aggregates |
| `controller/resolver/fragments.go` | `collectReferencedFragments` |
| `controller/resolver/variable_resolution.go` | Resolve `$var` in remote operations |
| `connector/groupedaggregate/` | `Executor` interface implemented by SQL connector |
| `internal/jsonpath/path.go` | Nested-path navigation |
| `integration/query_remote_relationships_test.go` | End-to-end coverage |
