# Schema Customization (developer view)

This document explains how Hasura-style GraphQL **schema customization** works inside Constellation. The user-facing reference is the customization rows in `docs/user/hasura-metadata-support.md`; this one is for people changing the implementation.

Customization renames a connector's GraphQL surface — wrapping root fields under a namespace, prefixing/suffixing root field names, and renaming types — without the connector knowing. It is implemented as a **decorator** around any `connector.Connector`, so the same transform applies uniformly to SQL, SQLite, in-memory, and remote-schema sources. Two Hasura config shapes (database `sources[].customization` and `remote_schemas[].definition.customization`) feed it; both normalize to one `metadata.Customization`.

## The shape of the problem

A customization is one config (`metadata.Customization`) that has to be applied in **three directions**, all derived from the same data:

| Direction | Method | When | What it does |
|---|---|---|---|
| **Forward (schema)** | `Customizer.Apply` | build time | Rewrites the connector's schema: rename types, rename root fields, wrap root fields under a namespace field. |
| **Inverse (operation)** | `Customizer.ReverseOperation` | request time, before `ValidateOperation` and `Execute` | Rewrites the incoming operation from customized names back to the connector's native names. |
| **Forward (result)** | `Customizer.ForwardResult` | request time, after `Execute` | Reshapes the native response back into customized shape: re-nest the namespace, re-map `__typename`. |

The forward and inverse transforms must stay in lockstep, which is why `Apply` records the native↔customized type maps that the reverse direction reads — and why **one `Customizer` instance must drive all three** (`customization.go`). `newCustomizedConnector` constructs exactly one and reuses it.

## Lifecycle

```
Build time
──────────
Hasura sources[].customization / remote_schemas[].definition.customization
        │  convert.go: convertDatabaseCustomization (134) / convertRemoteSchemaCustomization (506)
        ▼
metadata.Customization        (one normalized shape; cfg.IsZero() gates everything)
        │  BuildConnectorsFromMetadata → buildDatabaseConnectors (216) / buildRemoteSchemaConnectors (181)
        ▼  applyCustomization(name, inner, cfg, flavor)            (customized_connector.go)
        │    • cfg.IsZero()        → return inner unchanged
        │    • len(FieldNames) > 0 → error (rejected, see below)
        │    • customizer = customization.New(cfg, flavor)
        │    • for each role schema: customizer.Apply(schema)      ← forward (schema)
        ▼
customizedConnector{ inner, customizer, schemas }   implements connector.Connector
        │
        ▼  merged into each role schema by connector/composer — oblivious to customization

Request time (pre-execution validation, when the controller runs it)
────────────────────────────────────────────────────────────────────
client operation (customized names)
        │  customizedConnector.ValidateOperation                  (customized_connector.go)
        ▼  customizer.ReverseOperation(op, fragments)             ← inverse (operation)
inner.ValidateOperation(nativeOp, nativeFragments, …)
        │  query-validation argument paths are native at this point
        ▼  customizer.ForwardArgumentPath via remapQueryValidationArgumentPath
client-facing validation error path (on error) → controller

Request time (query / mutation)
───────────────────────────────
client operation (customized names)
        │  customizedConnector.Execute                            (customized_connector.go)
        ▼  customizer.ReverseOperation(op, fragments)             ← inverse (operation)
inner.Execute(nativeOp, nativeFragments, …) → native result
        │  (result is keyed by the customized response keys — ReverseOperation aliases them)
        ▼  customizer.ForwardResult(result, op, fragments)        ← forward (result)
map[string]any in customized shape → controller
```

`applyCustomization` is the single seam where customization is layered on. The composer, planner, controller, and resolver never reference the `customization` package — they see a `connector.Connector` whose schema, pre-execution validation behavior, and results are already customized.

## Metadata normalization

Both Hasura shapes are parsed into `metadata.Customization` (`metadata/customization.go`) by the converters in `metadata/convert.go`:

- **Database** (`convertDatabaseCustomization`, `convert.go`): `root_fields.{namespace,prefix,suffix}` → `RootFields*`; `type_names.{prefix,suffix}` → `TypeNames{Prefix,Suffix}`. Databases get no `TypeNamesMapping` and no `FieldNames`. `naming_convention` is intentionally not modeled.
- **Remote schema** (`convertRemoteSchemaCustomization`, `convert.go`): `root_fields_namespace` → `RootFieldsNamespace`; `type_names.{prefix,suffix,mapping}` → `TypeNames*`; `field_names` → `FieldNames`. Remote schemas express a root-field prefix/suffix through a `FieldNames` entry targeting the root type, so `RootFieldsPrefix`/`Suffix` are always empty for them.

`Customization.IsZero()` (`customization.go`) is the gate: a zero customization wraps nothing, so connectors with no customization pay zero cost.

## Forward (schema): `Apply`

`Apply` (`customization.go`) clones the schema first — connectors hand out **shared** `*graph.Schema` pointers from `GetSchema`, and the transform mutates names in place, so it must own a private copy (`cloneSchema`, `clone.go`). It then runs three passes via a `renamer` (`customization.go`):

1. **Pass A — references & non-root field names** (`rewriteReferencesAndFieldNames`, `customization.go`): rename every type *reference* (field types, argument types, interface/union members) and rename field names on non-root object/interface types. Root types are deferred because their fields may be relocated.
2. **Pass B — roots** (`rewriteRoots`, `customization.go`): rename root field names (with the root prefix/suffix) and, if a namespace is configured, move each root operation type's fields onto a new **wrapper type** and replace the root's fields with a single nullable namespace field.
3. **Pass C — definition names** (`rewriteDefinitionNames`, `customization.go`): rename every non-root type *definition*. Root operation types are left alone — `schemamerge` later flattens their fields onto `query_root`/`mutation_root`/`subscription_root`, so their names never reach the final schema, and renaming them would collide with the wrapper minted in Pass B.

Alongside the passes, `recordTypeMaps` (`customization.go`) records the native↔customized name for every renamable (non-root, non-builtin) type into `typeForward`/`typeInverse`. These maps are what the reverse and result directions consult.

### What never gets renamed

- **Builtin scalars** (`String`, `Int`, `Float`, `Boolean`, `ID`) — `builtinScalars` (`customization.go`). Custom scalars *are* renamed.
- **Shared database types** — under `FlavorDatabase`, every scalar, the `order_by` enum, and every `*_comparison_exp` input are left uncustomized (`sharedTypeNames`, `customization.go`). Hasura does this so these types still dedup across sources in the merged schema; we mirror it to keep the merged schema and the Hasura diff aligned.

## Inverse (operation): `ReverseOperation`

`ReverseOperation` (`operation.go`) rebuilds the operation and fragments — it never mutates the inputs, because the planner shares them across connectors. Two things are undone:

- **The namespace wrapper.** `reverseRootSelections` (`operation.go`) lifts the children of each root-level namespace field up to the root. It descends through inline fragments and fragment spreads (`liftRootSelection`, `selectionsContainNamespace`) because the subscription path reverses the raw client operation, which can carry a root-level fragment. The query/mutation path only ever passes top-level `*ast.Field` root selections (the planner builds the per-connector sub-operation from fields only), so the fragment handling matters mainly for subscriptions.
- **Type and field renaming.** Type conditions on fragments and named types in variable definitions are mapped back via `reverseTypeName` (`operation.go`) / `reverseASTType`. Root field names are reversed via `reverseRootFieldName` (`operation.go`).

For **database** namespaces, wrapper fragments are expanded to native root fields (with spread directives evaluated using coerced variables), because SQL execution does not visit root fragment spreads. Multiple database namespace response keys assign distinct collision-checked native child aliases, then re-nest by client response key; compatible duplicate children merge before native execution. **Remote-schema** namespaces retain inline fragments and spreads, including their variable directives, and map wrapper type conditions to the native operation root. Their lifted children stay unaliased and unmerged: identical children can resolve together, but differing child arguments conflict under remote GraphQL validation rather than executing independently. This preserves remote error paths without private aliases. Root-field reversal is **root-level only**, mirroring the forward path (where the prefix/suffix is applied only to root fields). `reverseSelections`/`reverseSelection` (`operation.go`) thread an `isRoot` flag: `reverseRootFieldName` runs only when `isRoot` is set, and descending into a field's own selection set clears it, so a nested column or relationship whose name happens to collide with the root prefix/suffix is left untouched. A root-level inline fragment propagates the flag (its fields are still root fields). A root fragment *definition* is treated as root when `fragmentCarriesRootFields` (`operation.go`) accepts its type condition — true both for a root operation type (`isRootOperationType`) **and** for a namespace **wrapper** type. `Apply` records the customized wrapper names onto the `Customizer` (`wrapperTypes`) precisely so the reverse path can recognize a fragment written `on <namespace>_subscription` and strip the affix from the root fields it carries. Threading structure rather than checking `field.ObjectDefinition.Name == "Query"` is what makes this correct when a namespace and a prefix/suffix combine — the prefixed root fields then live on the wrapper type, not on `Query`.

To preserve the client's response keys, `reverseSelection` aliases a renamed root field back to its customized name when the client gave no explicit alias. That is what lets `ForwardResult` find data under the keys the caller expects with no extra key remapping.

> Per-type `field_names` reversal is **not** implemented — which is why a connector configured with `field_names` is rejected at construction (see Known limitations).

## Forward (result): `ForwardResult`

`ForwardResult` (`result.go`) collects compatible occurrences of each response key (including through fragments), then walks their combined **customized** selection set alongside the shared native data (`resultWalker`, `result.go`). This prevents occurrence order or the raw-JSON fast path from discarding selected fields or preserving a native `__typename`. It rebuilds the response map:

- **Namespace re-nesting** (`field`, `result.go`): at the root level, the namespace field's children were returned lifted to the top level; they are re-nested under the namespace response key.
- **`__typename` re-mapping**: native type names are mapped to customized names via `forwardTypeName` (`result.go`).
- **Raw-JSON fast path**: SQL connectors return field subtrees as raw `jsontext.Value` bytes. Decoding them only to re-map `__typename` would be wasteful, so `rawValue` (`result.go`) decodes-and-rewalks **only** when (a) the customization actually renames types (`remapsTypeNames`, `result.go`) **and** (b) the subtree selects `__typename` somewhere (`fieldSelectsTypename`, memoized per field). Otherwise the raw bytes pass through untouched — behaviour-preserving, since the only thing the rewalk changes is `__typename` strings.

## The decorator: `customizedConnector`

`customizedConnector` (`customized_connector.go`) holds the inner connector, the single `Customizer`, and the pre-customized per-role `schemas` (computed once at construction). Keep its godoc immediately adjacent to the type declaration (no blank line); `go doc -u ./services/constellation/connector customizedConnector` confirms attachment. The `connector.Connector` methods:

- `GetSchema` — returns the cached customized schemas.
- `Execute` — `ReverseOperation` → `inner.Execute` → `ForwardResult`. It reshapes any returned data **even on error** (a GraphQL error can carry partial data), then re-wraps the error so the controller can still extract structured remote errors.
- `ValidateOperation` — `ReverseOperation` → `inner.ValidateOperation`. It delegates validation to the wrapped connector using native field/argument names, then remaps query-validation argument paths with `ForwardArgumentPath` before wrapping the error. Native SQL validation stamps field names, not response aliases. Even with multiple aliases of a database namespace, validation paths use the namespace and child **field names** (as Hasura does); the decorator does not revalidate or rerun roots to identify an alias.
- `ExecuteGroupedCollection` / `ExecuteGroupedAggregate` — forward grouped requests to a capable inner SQL connector without root-name reversal: requests carry native table identity and nested fields. The result walker remaps grouped `__typename` selections through aliases and fragments copy-on-write. A non-capable inner fails closed.
- `GetTypeName` — **delegates unchanged** for native root execution. `GetCustomizedTypeName` maps only known native types to published SDL names; composer/planner use this distinct mapping to inject relationships into renamed types. Derived aggregate and input types are mapped individually, not by appending a suffix to an already-prefixed/suffixed name.
- `Close` — delegates.

## Subscriptions: `customizedSubscriptionHandler`

Subscriptions don't flow through `Execute`; they go through a separate handler. `customizedConnector` exposes `NewSubscriptionHandler` (`customized_subscription.go`) only when its inner connector implements the optional `subscriptionCapable` interface; otherwise it returns **nil**.

That nil is a contract change worth knowing: `controller.buildState` used to dereference the result of `NewSubscriptionHandler` directly. Because a customization wrapper advertises the capability (it has the method) but cannot serve it for a non-subscription inner connector (e.g. a remote schema), `buildState` now **skips nil handlers** (`controller/controller.go`, including the nil guard in shutdown). When touching the subscription-capable interface, keep both sides in sync.

The handler decorates the stream: `Start` reverses the operation to native names before starting the inner subscription, then spawns `forward` to reshape each update's data via `ForwardResult` and relay it. Relaying uses `sendLatest` — a non-blocking, drop-oldest send that mirrors the cohort's buffered(1) latest-wins semantics so a slow or departed consumer never blocks (and never leaks) the forwarding goroutine.

## Flavors and Hasura parity

`Flavor` (`customization.go`) selects source-specific naming for the **namespace wrapper type**, which survives into the final schema and so must match Hasura byte-for-byte (the integration suite diffs against a live Hasura introspection). `wrapperTypeName` (`wrappername.go`):

- **`FlavorRemoteSchema`** — `<namespace>Query` / `<namespace>Mutation` / `<namespace>Subscription`, namespace verbatim, **type prefix/suffix not applied**.
- **`FlavorDatabase`** — `<namespace>_query` / `<namespace>_mutation_frontend` / `<namespace>_subscription` (note the `_mutation_frontend` suffix Hasura emits), **with** the type prefix/suffix applied on top.

The connector layer knows which kind it is wrapping and passes the right flavor in `applyCustomization`.

## Known limitations

These are deliberate, documented carve-outs — not bugs:

- **`field_names` is rejected at construction** (`newCustomizedConnector`, `customized_connector.go`). `Apply` would rename such fields forward, but the execution path does not reverse them, so the schema would advertise fields that queries can't resolve. Failing at startup turns silent runtime breakage into a clear config error. Pinned by `TestNewCustomizedConnectorRejectsFieldNames`.
- **Database `to_source` relationships on a namespace-only or namespace + type-prefix source work.** The planner walks through wrapper and row fragments, the customized connector lifts wrapper fragments to native roots, and the controller decodes raw rows before stitching and deleting phantoms. Physical LHS columns hidden from a role can join without appearing in results. Duplicate response keys from wrapper fragments and direct fields collect their selections before forwarding raw results: selected `__typename` values use published names and no selected fields disappear. Computed keys still need the role's select grant and the target's actual selectable SQL column. Target row/column filters hold. The checked-in matrix covers these source forms, root-prefix and plain controls, nested joins, aliases/variables, admin and filtered-role aggregates, and fail-closed errors.
- **Type-prefixed/suffixed database targets work for object/array `to_source` joins**, per-parent collection windows and aggregate siblings; the SQL executors receive native table identity. A namespace with target type prefix also works. The source and target mappings remain connector-scoped; unknown/untracked identifiers are never synthesized into a type. Database-to-remote-schema relationships into a type-renamed remote schema remain unavailable. These tests do not claim parity for other remote-schema customization, other source customization shapes or mutations returning a remote relationship.
- **Two aliases of a namespaced remote schema do not execute independently when child arguments differ.** Native aliases and duplicate-root merging are database-only. Remote-schema children forward unaliased and unmerged: identical children work, but differing arguments are rejected by the remote's conflicting-fields validation before a mutation executes. No private alias appears in remote error paths. A single remote namespace alias is unaffected.
- **Subscriptions are only customized when the inner connector serves them** — remote schemas don't, so a namespaced remote schema exposes no customized subscriptions.

## Failure modes worth knowing

| Failure | Where | Handled by |
|---|---|---|
| `field_names` configured | `newCustomizedConnector` | error → `BuildConnectorsFromMetadata` fails reload |
| Inner `GetSchema` fails at construction | `newCustomizedConnector` | wrapped error → reload fails |
| Inner `ValidateOperation` returns a query-validation error | `customizedConnector.ValidateOperation` | native argument path remapped to the customized operation path and wrapped |
| Inner `Execute` returns an error with partial data | `customizedConnector.Execute` | data reshaped and returned alongside the wrapped error |
| Subscription update fails to reshape | `customizedSubscriptionHandler.forward` | converted to a `subscription.Update` error, stream continues |
| Inner connector is not subscription-capable | `NewSubscriptionHandler` | returns nil → `buildState` skips it |

## File reference

| File | Purpose |
|---|---|
| `connector/customization/customization.go` | `Customizer`, `New`, `Apply`, the `renamer`, `Flavor`, shared-type rules |
| `connector/customization/operation.go` | `ReverseOperation` and `ForwardArgumentPath` — namespace lift/remap, type/field-name reversal, fragments |
| `connector/customization/result.go` | `ForwardResult` — namespace re-nest, `__typename` re-map, raw-JSON fast path |
| `connector/customization/wrappername.go` | Hasura-parity wrapper type naming per flavor |
| `connector/customization/clone.go` | Deep copy of `graph.Schema` so `Apply` can mutate safely |
| `connector/customized_connector.go` | `customizedConnector` decorator, `applyCustomization`, `field_names` guard |
| `connector/customized_subscription.go` | `customizedSubscriptionHandler`, nil-handler contract, `sendLatest` |
| `connector/connector.go` | `buildDatabaseConnectors` / `buildRemoteSchemaConnectors` wiring |
| `metadata/customization.go` | `Customization` / `FieldNameCustomization`, `IsZero` |
| `metadata/convert.go` | `convertDatabaseCustomization`, `convertRemoteSchemaCustomization` |
| `controller/controller.go` | `subscriptionCapableConnector`, nil-handler skip in `buildState` |

## See also

- `docs/user/hasura-metadata-support.md` — operator-facing support matrix (which customization fields are honored).
- [remote-schemas.md](./remote-schemas.md) — the most common connector wrapped by customization.
- [subscriptions.md](./subscriptions.md) — cohort/handler mechanics the subscription decorator sits in front of.
- `connector/customization/customization.go` package godoc — concise summary of the three directions.
