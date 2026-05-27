# Schema Customization (developer view)

This document explains how Hasura-style GraphQL **schema customization** works inside Constellation. The user-facing reference is the customization rows in `docs/user/hasura-metadata-support.md`; this one is for people changing the implementation.

Customization renames a connector's GraphQL surface — wrapping root fields under a namespace, prefixing/suffixing root field names, and renaming types — without the connector knowing. It is implemented as a **decorator** around any `connector.Connector`, so the same transform applies uniformly to SQL, SQLite, in-memory, and remote-schema sources. Two Hasura config shapes (database `sources[].customization` and `remote_schemas[].definition.customization`) feed it; both normalize to one `metadata.Customization`.

## The shape of the problem

A customization is one config (`metadata.Customization`) that has to be applied in **three directions**, all derived from the same data:

| Direction | Method | When | What it does |
|---|---|---|---|
| **Forward (schema)** | `Customizer.Apply` | build time | Rewrites the connector's schema: rename types, rename root fields, wrap root fields under a namespace field. |
| **Inverse (operation)** | `Customizer.ReverseOperation` | request time, before `Execute` | Rewrites the incoming operation from customized names back to the connector's native names. |
| **Forward (result)** | `Customizer.ForwardResult` | request time, after `Execute` | Reshapes the native response back into customized shape: re-nest the namespace, re-map `__typename`. |

The forward and inverse transforms must stay in lockstep, which is why `Apply` records the native↔customized type maps that the reverse direction reads — and why **one `Customizer` instance must drive all three** (`customization.go:217-241`). `newCustomizedConnector` constructs exactly one and reuses it.

## Lifecycle

```
Build time
──────────
Hasura sources[].customization / remote_schemas[].definition.customization
        │  convert.go: convertDatabaseCustomization (134) / convertRemoteSchemaCustomization (506)
        ▼
metadata.Customization        (one normalized shape; cfg.IsZero() gates everything)
        │  BuildConnectorsFromMetadata → buildDatabaseConnectors (216) / buildRemoteSchemaConnectors (181)
        ▼  applyCustomization(name, inner, cfg, flavor)            (customized_connector.go:49)
        │    • cfg.IsZero()        → return inner unchanged
        │    • len(FieldNames) > 0 → error (rejected, see below)
        │    • customizer = customization.New(cfg, flavor)
        │    • for each role schema: customizer.Apply(schema)      ← forward (schema)
        ▼
customizedConnector{ inner, customizer, schemas }   implements connector.Connector
        │
        ▼  merged into each role schema by connector/composer — oblivious to customization

Request time (query / mutation)
───────────────────────────────
client operation (customized names)
        │  customizedConnector.Execute                            (customized_connector.go:116)
        ▼  customizer.ReverseOperation(op, fragments)             ← inverse (operation)
inner.Execute(nativeOp, nativeFragments, …) → native result
        │  (result is keyed by the customized response keys — ReverseOperation aliases them)
        ▼  customizer.ForwardResult(result, op, fragments)        ← forward (result)
map[string]any in customized shape → controller
```

`applyCustomization` is the single seam where customization is layered on. The composer, planner, controller, and resolver never reference the `customization` package — they see a `connector.Connector` whose schema and results are already customized.

## Metadata normalization

Both Hasura shapes are parsed into `metadata.Customization` (`metadata/customization.go`) by the converters in `metadata/convert.go`:

- **Database** (`convertDatabaseCustomization`, `convert.go:134`): `root_fields.{namespace,prefix,suffix}` → `RootFields*`; `type_names.{prefix,suffix}` → `TypeNames{Prefix,Suffix}`. Databases get no `TypeNamesMapping` and no `FieldNames`. `naming_convention` is intentionally not modeled.
- **Remote schema** (`convertRemoteSchemaCustomization`, `convert.go:506`): `root_fields_namespace` → `RootFieldsNamespace`; `type_names.{prefix,suffix,mapping}` → `TypeNames*`; `field_names` → `FieldNames`. Remote schemas express a root-field prefix/suffix through a `FieldNames` entry targeting the root type, so `RootFieldsPrefix`/`Suffix` are always empty for them.

`Customization.IsZero()` (`customization.go:54`) is the gate: a zero customization wraps nothing, so connectors with no customization pay zero cost.

## Forward (schema): `Apply`

`Apply` (`customization.go:258`) clones the schema first — connectors hand out **shared** `*graph.Schema` pointers from `GetSchema`, and the transform mutates names in place, so it must own a private copy (`cloneSchema`, `clone.go`). It then runs three passes via a `renamer` (`customization.go:45`):

1. **Pass A — references & non-root field names** (`rewriteReferencesAndFieldNames`, `customization.go:318`): rename every type *reference* (field types, argument types, interface/union members) and rename field names on non-root object/interface types. Root types are deferred because their fields may be relocated.
2. **Pass B — roots** (`rewriteRoots`, `customization.go:376`): rename root field names (with the root prefix/suffix) and, if a namespace is configured, move each root operation type's fields onto a new **wrapper type** and replace the root's fields with a single nullable namespace field.
3. **Pass C — definition names** (`rewriteDefinitionNames`, `customization.go:438`): rename every non-root type *definition*. Root operation types are left alone — `schemamerge` later flattens their fields onto `query_root`/`mutation_root`/`subscription_root`, so their names never reach the final schema, and renaming them would collide with the wrapper minted in Pass B.

Alongside the passes, `recordTypeMaps` (`customization.go:295`) records the native↔customized name for every renamable (non-root, non-builtin) type into `typeForward`/`typeInverse`. These maps are what the reverse and result directions consult.

### What never gets renamed

- **Builtin scalars** (`String`, `Int`, `Float`, `Boolean`, `ID`) — `builtinScalars` (`customization.go:34`). Custom scalars *are* renamed.
- **Shared database types** — under `FlavorDatabase`, every scalar, the `order_by` enum, and every `*_comparison_exp` input are left uncustomized (`sharedTypeNames`, `customization.go:110`). Hasura does this so these types still dedup across sources in the merged schema; we mirror it to keep the merged schema and the Hasura diff aligned.

## Inverse (operation): `ReverseOperation`

`ReverseOperation` (`operation.go:21`) rebuilds the operation and fragments — it never mutates the inputs, because the planner shares them across connectors. Two things are undone:

- **The namespace wrapper.** `reverseRootSelections` (`operation.go:88`) lifts the children of each root-level namespace field up to the root. It descends through inline fragments and fragment spreads (`liftRootSelection`, `selectionsContainNamespace`) because the subscription path reverses the raw client operation, which can carry a root-level fragment. The query/mutation path only ever passes top-level `*ast.Field` root selections (the planner builds the per-connector sub-operation from fields only), so the fragment handling matters mainly for subscriptions.
- **Type and field renaming.** Type conditions on fragments and named types in variable definitions are mapped back via `reverseTypeName` (`operation.go:382`) / `reverseASTType`. Root field names are reversed via `reverseRootFieldName` (`operation.go:308`).

Root-field reversal is **root-level only**, mirroring the forward path (where the prefix/suffix is applied only to root fields). `reverseSelections`/`reverseSelection` (`operation.go:206`, `:222`) thread an `isRoot` flag: `reverseRootFieldName` runs only when `isRoot` is set, and descending into a field's own selection set clears it, so a nested column or relationship whose name happens to collide with the root prefix/suffix is left untouched. A root-level inline fragment propagates the flag (its fields are still root fields). A root fragment *definition* is treated as root when `fragmentCarriesRootFields` (`operation.go:280`) accepts its type condition — true both for a root operation type (`isRootOperationType`) **and** for a namespace **wrapper** type. `Apply` records the customized wrapper names onto the `Customizer` (`wrapperTypes`) precisely so the reverse path can recognize a fragment written `on <namespace>_subscription` and strip the affix from the root fields it carries. Threading structure rather than checking `field.ObjectDefinition.Name == "Query"` is what makes this correct when a namespace and a prefix/suffix combine — the prefixed root fields then live on the wrapper type, not on `Query`.

To preserve the client's response keys, `reverseSelection` aliases a renamed root field back to its customized name when the client gave no explicit alias. That is what lets `ForwardResult` find data under the keys the caller expects with no extra key remapping.

> Per-type `field_names` reversal is **not** implemented — which is why a connector configured with `field_names` is rejected at construction (see Known limitations).

## Forward (result): `ForwardResult`

`ForwardResult` (`result.go:19`) walks the **customized** selection set alongside the native data (`resultWalker`, `result.go:40`) and rebuilds the response map:

- **Namespace re-nesting** (`field`, `result.go:86`): at the root level, the namespace field's children were returned lifted to the top level; they are re-nested under the namespace response key.
- **`__typename` re-mapping**: native type names are mapped to customized names via `forwardTypeName` (`result.go:227`).
- **Raw-JSON fast path**: SQL connectors return field subtrees as raw `jsontext.Value` bytes. Decoding them only to re-map `__typename` would be wasteful, so `rawValue` (`result.go:161`) decodes-and-rewalks **only** when (a) the customization actually renames types (`remapsTypeNames`, `result.go:219`) **and** (b) the subtree selects `__typename` somewhere (`fieldSelectsTypename`, memoized per field). Otherwise the raw bytes pass through untouched — behaviour-preserving, since the only thing the rewalk changes is `__typename` strings.

## The decorator: `customizedConnector`

`customizedConnector` (`customized_connector.go:38`) holds the inner connector, the single `Customizer`, and the pre-customized per-role `schemas` (computed once at construction). The `connector.Connector` methods:

- `GetSchema` — returns the cached customized schemas.
- `Execute` (`:116`) — `ReverseOperation` → `inner.Execute` → `ForwardResult`. It reshapes any returned data **even on error** (a GraphQL error can carry partial data), then re-wraps the error so the controller can still extract structured remote errors.
- `GetTypeName` (`:145`) — **delegates unchanged** to the inner connector. This is deliberate and is the seam behind the customization × remote-relationships limitation below.
- `Close` — delegates.

## Subscriptions: `customizedSubscriptionHandler`

Subscriptions don't flow through `Execute`; they go through a separate handler. `customizedConnector` exposes `NewSubscriptionHandler` (`customized_subscription.go:31`) only when its inner connector implements the optional `subscriptionCapable` interface (`:19`); otherwise it returns **nil**.

That nil is a contract change worth knowing: `controller.buildState` used to dereference the result of `NewSubscriptionHandler` directly. Because a customization wrapper advertises the capability (it has the method) but cannot serve it for a non-subscription inner connector (e.g. a remote schema), `buildState` now **skips nil handlers** (`controller/controller.go:177-188`, and the nil guard in shutdown at `:97`). When touching the subscription-capable interface, keep both sides in sync.

The handler decorates the stream: `Start` (`:56`) reverses the operation to native names before starting the inner subscription, then spawns `forward` (`:94`) to reshape each update's data via `ForwardResult` and relay it. Relaying uses `sendLatest` (`:144`) — a non-blocking, drop-oldest send that mirrors the cohort's buffered(1) latest-wins semantics so a slow or departed consumer never blocks (and never leaks) the forwarding goroutine.

## Flavors and Hasura parity

`Flavor` (`customization.go:204`) selects source-specific naming for the **namespace wrapper type**, which survives into the final schema and so must match Hasura byte-for-byte (the integration suite diffs against a live Hasura introspection). `wrapperTypeName` (`wrappername.go:17`):

- **`FlavorRemoteSchema`** — `<namespace>Query` / `<namespace>Mutation` / `<namespace>Subscription`, namespace verbatim, **type prefix/suffix not applied**.
- **`FlavorDatabase`** — `<namespace>_query` / `<namespace>_mutation_frontend` / `<namespace>_subscription` (note the `_mutation_frontend` suffix Hasura emits), **with** the type prefix/suffix applied on top.

The connector layer knows which kind it is wrapping and passes the right flavor in `applyCustomization`.

## Known limitations

These are deliberate, documented carve-outs — not bugs:

- **`field_names` is rejected at construction** (`newCustomizedConnector`, `customized_connector.go:84`). `Apply` would rename such fields forward, but the execution path does not reverse them, so the schema would advertise fields that queries can't resolve. Failing at startup turns silent runtime breakage into a clear config error. Pinned by `TestNewCustomizedConnectorRejectsFieldNames`.
- **Customization × remote relationships on the same source is not handled.** The composer injects relationship fields keyed by native type names (via `GetTypeName`, which the decorator delegates), while the schema renames those types. No metadata in use combines the two. The divergence is pinned by `TestCustomizedConnectorRelationshipNamingDivergence` so any change to the `GetTypeName`-vs-schema contract is caught.
- **Subscriptions are only customized when the inner connector serves them** — remote schemas don't, so a namespaced remote schema exposes no customized subscriptions.

## Failure modes worth knowing

| Failure | Where | Handled by |
|---|---|---|
| `field_names` configured | `newCustomizedConnector` | error → `BuildConnectorsFromMetadata` fails reload |
| Inner `GetSchema` fails at construction | `newCustomizedConnector` | wrapped error → reload fails |
| Inner `Execute` returns an error with partial data | `customizedConnector.Execute` | data reshaped and returned alongside the wrapped error |
| Subscription update fails to reshape | `customizedSubscriptionHandler.forward` | converted to a `subscription.Update` error, stream continues |
| Inner connector is not subscription-capable | `NewSubscriptionHandler` | returns nil → `buildState` skips it |

## File reference

| File | Purpose |
|---|---|
| `connector/customization/customization.go` | `Customizer`, `New`, `Apply`, the `renamer`, `Flavor`, shared-type rules |
| `connector/customization/operation.go` | `ReverseOperation` — namespace lift, type/field-name reversal, fragments |
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
