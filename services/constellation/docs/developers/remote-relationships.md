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
│  • BuildRemoteQueriesFromPlan: plan + parent results → RemoteQuery   │
│  • RemoteRelationshipResolver.Resolve: execute, stitch, clean up     │
│  • Per-strategy DatabaseResolver / SchemaResolver / AggregateInfo    │
└──────────────────────────────────────────────────────────────────────┘
```

The key architectural choice is that **connectors do not detect remote relationships**. The planner produces a clean per-connector operation; the connector executes that operation exactly as it would for a single-source query. All cross-connector reasoning lives in `controller/planner` (compile-time) and `controller/resolver` (run-time).

## Planning phase

`QueryPlanner.Plan` (`controller/planner/planner.go:51`) processes one root-field group at a time:

```go
analyzer := newAnalyzer(connectorName, schema, relationships, operation.Operation, fragments)
subOp := BuildSubOperation(operation, fields)
analysis := analyzer.analyzeOperation(subOp)

transformer := newASTTransformer(schema, relationships, connectorName, p.typeToConnector)
transformResult := transformer.Transform(subOp, fragments)

injectPhantomFields(transformResult.CleanOperation, analysis.PhantomFields)

plan.PrimaryQueries = append(plan.PrimaryQueries, &PrimaryQuery{...})
plan.RemoteQueries = append(plan.RemoteQueries, analysis.RemoteQueries...)
```

### Analyzer

`controller/planner/analyzer.go` recursively walks the selection set keeping track of the current `typeName` and `jsonpath.Path`. For each field whose `(typeName, fieldName)` matches a `RelationshipMetadata` with `IsRemote=true` it:

- Adds the join columns from `JoinMapping` to a phantom set (`neededPhantoms`).
- Builds a `RemoteQueryPlan` capturing the source path, target connector, output alias, the user's `Selection`, and whether the resolver strategy is database or schema (`ResolverKindSchema` when `RemoteFieldPath` is non-empty).
- Continues walking *non*-relationship fields so nested cross-connector relationships are also detected.

The analyzer expands `*ast.FragmentSpread` and `*ast.InlineFragment` so relationships defined on fragment-targeted types are caught.

### Phantom field specification

After detecting relationships, the analyzer subtracts fields the user already selected (`collectSelectedFields`) from `neededPhantoms` and records the remainder as a `PhantomFieldSpec`:

```go
type PhantomFieldSpec struct {
    Path            jsonpath.Path     // e.g. ["users", "profile"]
    Fields          []string          // e.g. ["department_id"]
    ForRelationship string
}
```

The spec is referenced from every `RemoteQueryPlan` that shares the same source path, so the resolver can later look up which phantom fields belong to which relationship.

### AST transformer

`controller/planner/ast_transformer.go` walks the same sub-operation, producing a deep-cloned `CleanOperation` and `CleanFragments`:

- **Strips** any field whose `(typeName, fieldName)` is a remote relationship.
- **Filters** fragments whose `TypeCondition` belongs to a different connector (`t.typeToConnector[typeName] != t.connectorName`). This prevents validation errors when a fragment defined for one DB's types is sent to another.
- **Drops** fragment spreads that reference fragments which were filtered out or became empty after stripping.

Because the transformer always returns a fresh AST, callers can mutate the result without affecting the planner's shared trees.

### Phantom injection

`injectPhantomFields` (`controller/planner/ast_transformer.go:421`) mutates the *clean* operation in place — safe because it is already a clone — to add each phantom field name at the path the analyzer recorded. The Connector therefore receives a self-contained operation that includes every column the resolver will need to join against.

## Runtime phase

After connectors return, `Controller.resolveRemoteRelationships` (`controller/resolve.go:353`) runs the resolver pipeline.

### 1. Materialise raw JSON

SQL connectors return `jsontext.Value` (raw JSON) by default for the response fast path. The resolver needs map traversal, so `resolver.UnmarshalRawResults` materialises them into nested `map[string]any` / `[]any` values once.

### 2. Build `RemoteQuery` objects

`BuildRemoteQueriesFromPlan` (`controller/resolver/remote_query_builder.go:20`):

1. Calls `extractJoinArgumentsFromPlan` to walk the source path with `jsonpath.Path.ToRows`, collecting every parent row.
2. Builds unique `RemoteJoinArgument` values, hashed by `(sourceColumns sorted, joined with "|")`. Rows with any null source value are skipped (no join target).
3. Selects the resolver strategy:
   - `IsArrayAggregate` plans bypass `Resolver` entirely and carry an `AggregateInfo` payload.
   - `ResolverKindSchema` plans get a `SchemaResolver`.
   - Everything else gets a `DatabaseResolver`, with the target table name resolved through `Connector.GetTypeName(schema.table)` so custom type names work.
4. Returns the resulting `[]*RemoteQuery`.

Plans where every parent row had null join values produce zero `JoinArguments` — those queries are filtered out before the resolver loop.

### 3. Execute and stitch

`RemoteRelationshipResolver.Resolve` (`controller/resolver/remote_relationship_resolver.go:45`):

```go
for _, rq := range pendingQueries {
    r.executeAndStitch(ctx, results, rq, fragments, variables, role, sessionVariables, logger)
}
r.removeAllLocalPhantomFields(results, pendingQueries)
```

`executeAndStitch` does five things:

1. **Aggregate fast path** — if `rq.AggregateInfo != nil`, dispatch directly to the target connector's `groupedaggregate.Executor`. See ["Cross-DB grouped aggregates"](#cross-db-grouped-aggregates) below.
2. **Build the remote operation** via `rq.Resolver.BuildOperation(rq)`.
3. **Resolve variable references** in the remote operation's arguments (`resolveVariableReferences`). The remote operation is a standalone query with no variable definitions, so `$stats`-style references must be substituted with literal values.
4. **Filter fragments** down to only those the remote operation references (`collectReferencedFragments`). Other fragments may carry types that exist only on the source schema.
5. **Execute** against the target connector, then `ExtractResults` → `BuildResultLookup` → `stitchResults`. Remote phantom fields are removed from the remote results immediately after stitching.

After all queries finish, `removeAllLocalPhantomFields` deletes the phantom columns injected into the source results, deduplicating by path so two relationships sharing a source path don't fight.

### 4. Final cleanup

`controller/resolver/remote_relationship_resolver.go:RemovePhantomFieldsFromPlan` runs *unconditionally* after every request — even when no remote relationships ended up firing (e.g. all join keys were null). This guarantees no phantom column ever leaks into the response.

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

It also includes the target join column in the selection set as a phantom if the user didn't request it. `BuildResultLookup` then keys by the sorted join-column values, and `stitchResults` walks the source rows and writes the matching results in place.

When the user aliased the join column (`userId: id`), `buildColumnAliasMap` records the alias so the lookup uses it instead of the original column name.

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

When a db→db array relationship exposes its `_aggregate` sibling field (e.g. `posts_aggregate` on `User`), the planner emits a separate `RemoteQueryPlan` with `IsArrayAggregate=true`. `BuildRemoteQueriesFromPlan` skips the resolver entirely and produces a `RemoteQuery` whose `AggregateInfo` carries the target table identity and join mapping.

`executeAndStitchAggregate` (`controller/resolver/aggregate_resolver.go:31`) then:

1. Picks the single join column (currently only single-column joins are supported; `errAggregateMultiColumnJoinUnsupported`).
2. Type-asserts the target connector to `groupedaggregate.Executor`. This is implemented only by SQL connectors; if the target is a remote schema the call fails with `errAggregateConnectorNotSupported`.
3. Invokes `ExecuteGroupedAggregate` with the unique join values. The connector returns a `map[string]any` keyed by join value.
4. Writes the per-key aggregate result into each parent row. Parents whose join key has no entry receive a zero-valued `{aggregate: {...}, nodes: []}` shaped to match the user's selection.

The SQL builder for grouped aggregates lives in `connector/sql/graphql/queries/groupedaggregate/`; the executor adapter is in `connector/groupedaggregate/`.

## Phantom fields in detail

Two kinds of phantom column exist, and they have different lifetimes:

| Phantom kind | Added by | Path | Removed by |
|---|---|---|---|
| **Local (source-side)** | Planner via `injectPhantomFields` before connector execution | `PhantomFieldSpec.Path` on the source result | `RemoteRelationshipResolver.removeAllLocalPhantomFields` after all remote queries finish |
| **Remote (target-side)** | Resolver via `DatabaseResolver.BuildOperation` (added to `rq.RemotePhantomFields`) | Top of each result row from the remote connector | Resolver via `removePhantomFieldsFromRemoteResults`, immediately after stitching |

Belt-and-braces: `RemovePhantomFieldsFromPlan` runs after `Resolve` and clears anything that should be local-phantom regardless of whether the corresponding relationship actually fired. This protects against phantom leaks when every join key was null and the relationship was skipped.

## Join-key deduplication

Both at plan time (`buildJoinArguments`) and at lookup time (`BuildResultLookup`), keys are constructed by:

1. Sorting the source/LHS column names alphabetically.
2. Reading each value, converting with `fmt.Sprintf("%v", val)`.
3. Joining with `"|"`.

Sorting is critical — without it, a parent row produced via path traversal could hash differently from the equivalent join argument because the underlying map iteration order is non-deterministic.

Rows with any null join-key value are skipped. They cannot match remote results and there's no semantic difference between "the relationship didn't return a value" and "null in, null out".

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

1. **Queries only.** Subscriptions with remote relationships are rejected by `Controller.execute`. Mutations have no remote-relationship support in the SQL builder.
2. **rs→rs not supported.** `buildRSRelationships` only consumes `to_source` definitions on remote-schema metadata.
3. **Aggregate joins must be single-column.** Multi-column aggregate joins return `errAggregateMultiColumnJoinUnsupported`.
4. **Aggregate targets must be SQL connectors.** Remote schemas don't expose `groupedaggregate.Executor`.
5. **Null join keys skip.** If every parent row's join key is null, the relationship is dropped (no remote query). Object relationships then receive `null` and array relationships receive `[]` via the resolver's default stitching.

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
| `controller/resolver/remote_query_builder.go` | `BuildRemoteQueriesFromPlan`, join-argument extraction |
| `controller/resolver/remote_relationship_resolver.go` | `Resolve` loop, phantom cleanup |
| `controller/resolver/remote_query.go` | `RemoteQuery`, `RemoteQueryResolver`, stitching |
| `controller/resolver/database_resolver.go` | db→db, rs→db (WHERE _in) |
| `controller/resolver/schema_resolver.go` | db→rs (aliased fields) |
| `controller/resolver/aggregate_resolver.go` | Cross-DB grouped aggregates |
| `controller/resolver/fragments.go` | `collectReferencedFragments` |
| `controller/resolver/variable_resolution.go` | Resolve `$var` in remote operations |
| `connector/groupedaggregate/` | `Executor` interface implemented by SQL connector |
| `internal/jsonpath/path.go` | Nested-path navigation |
| `integration/query_remote_relationships_test.go` | End-to-end coverage |
