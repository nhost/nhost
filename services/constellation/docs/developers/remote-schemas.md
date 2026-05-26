# Remote Schemas (developer view)

This document explains how the remote-schema connector works inside Constellation. The user-facing reference is `docs/user/remote-schema.md`; this one is for people changing the implementation.

The connector lives in `connector/remoteschema/` and implements `connector.Connector` like the SQL connector. Its job is to make an external GraphQL endpoint appear as just another data source in the composed schema — including for cross-source remote relationships.

## Lifecycle

```
metadata.RemoteSchemaMetadata
        │
        ▼
remoteschema.New (connector.go)
  • resolve URL, timeout, static headers
  • buildRoleSchemas: parse SDL for every non-admin role
  • Introspect the live endpoint → admin schema
  • Construct httpClient
        │
        ▼
*Connector { schemas, presets, httpClient, forwardClientHeaders }
        │
        ▼ at request time
Connector.Execute
  • applyPresets (clone op, inject argument values)
  • buildQueryString (formatter)
  • httpClient.do (URL + header precedence)
  • parse {data, errors}
        │
        ▼
map[string]any returned to controller
```

`New` is synchronous and runs introspection at construction time. A non-reachable endpoint therefore fails immediately and the controller surfaces the error from `BuildConnectorsFromMetadata`. There's no retry loop — metadata reload is the recovery path.

## Per-role schemas

Two sources of truth coexist:

- **Admin** — always built from a live introspection request. Source: `introspectRemoteSchema` in `introspect.go`. The admin schema reflects whatever the remote actually exposes today.
- **Non-admin roles** — built from the `schema:` SDL block under that role's `permissions:` entry in metadata. Source: `parseSDL` in `schema.go`. Roles that don't have a permission entry get no schema and the role can't query the remote at all.

`buildRoleSchemas` (`connector.go:114`) walks all non-admin permissions and parses each. Admin is *intentionally* skipped — see the comment on that function — because the introspection result is authoritative.

Both paths funnel into `pruneUnreachableTypes` (`prune.go:46`). This walks reachability from `Query` / `Mutation` / `Subscription` (plus directive arguments) and drops any type that isn't reachable. Without pruning, a role's SDL could leak unrelated types into the composed schema; pruning makes sure only the types the role can actually reference survive.

## @preset directive

Non-admin roles use `@preset(value: "...")` on argument definitions to inject literal values or session variables, hiding the argument from the client. `parseSDL` extracts these:

- `extractPresetValue` walks each argument's directive list for `@preset` and captures the `value` argument.
- Arguments with `@preset` are *not* added to the exposed schema (`convertFields` drops them and records them under `presets["TypeName.fieldName"]`).
- The directive itself is also stripped from anything that *does* stay in the schema via `filterPresetDirective` — `@preset` is server-side policy and should not leak to introspection.

The directive declaration is parsed by prepending `presetDirectiveSDL` to the user's SDL before calling `gqlparser.LoadSchema`. The user never writes the `directive @preset(...)` declaration themselves.

At execute time, `applyPresets` (`execute.go:31`) clones the operation and walks every selection. For each `(typeName, fieldName)` with recorded presets it calls `applyFieldPresets`, which:

1. Calls `resolvePresetValue`: if the preset value starts with `x-hasura-`, look it up in `sessionVariables` (case-insensitive); otherwise treat as a literal string.
2. If the argument already exists in the operation, overwrite its `Value`. Otherwise append a new `*ast.Argument`.

`applyPresets` clones the operation deeply (`cloneOperation`) so the controller's shared AST is never mutated.

### Why nested-field presets need a validated operation

`applyPresetsToSelectionSet` resolves the nested type for a field via `sel.Definition.Type`. `sel.Definition` is populated by gqlparser only after validation. The non-admin operations going through `Connector.Execute` come from `Controller.execute` after `gqlparser.LoadQueryWithRules` validation, so this is fine in practice — but be aware if you ever invoke `applyPresets` outside the normal request path.

## Query rendering

After preset application, `buildQueryString` (`execute.go:314`) renders the operation + fragments to a GraphQL string using `gqlparser/formatter`. There's no clever rewriting here: whatever the planner stripped from the operation is already gone, whatever phantom fields the planner injected are already in, and presets have been applied. The connector just serialises and sends.

## HTTP request

`httpClient.do` (`http.go:89`) is the single send path. Header precedence is **lowest → highest** in the order applied:

1. Forwarded client headers (`applyClientHeaders`, only if `forward_client_headers: true`).
2. Session variables (`x-hasura-*` plus `x-hasura-role`).
3. `Content-Type: application/json`.
4. Statically configured headers (from `headers:` in metadata).

So statically configured values win over session, session wins over forwarded client headers. This is intentional: an operator's configured `Authorization` header should not be overridden by the caller.

### Client-header forwarding rules

`applyClientHeaders` (`http.go:56`) implements Hasura-compatible forwarding:

- **Dropped**: `Content-Length`, `Content-Md5`, `User-Agent`, `Host`, `Origin`, `Referer`, `Accept`, `Accept-Encoding`, `Accept-Language`, `Accept-Datetime`, `Cache-Control`, `Connection`, `Dnt`, `Content-Type`, `Transfer-Encoding`. The full list lives in `clientHeadersIgnored`.
- **Renamed**: `Host` → `X-Forwarded-Host`, `User-Agent` → `X-Forwarded-User-Agent`, `Origin` → `X-Forwarded-Origin`.
- **Suppressed**: any header starting with `x-hasura-` (case-insensitive). These are sent separately as session variables, not as client headers.

### The `HTTPDoer` seam

`HTTPDoer` is the interface that wraps `*http.Client`. Production callers pass `nil` to `New` and get a default `*http.Client{Timeout: ...}`; tests pass a mock generated by `mockgen`. The interface is exported only because the mock subpackage imports it; nothing else outside `connector/remoteschema/` constructs a `Connector` directly.

## Response handling

`executeRemoteQuery` (`execute.go:334`) decodes the JSON body into `graphQLResponse{Data, Errors}`. Two paths:

1. **No errors** — return `data` and `nil`. Common path.
2. **Errors present** — return `data` (which may have partial fields) *and* a `*GraphQLError` wrapping `gqlResp.Errors`. The controller's `executeConnectors` (`controller/resolve.go:308`) type-asserts this error and merges the structured remote errors into the response.

Partial responses matter: a GraphQL server is allowed to return `{"data": {...partial...}, "errors": [...]}`, and the controller must preserve both.

JSON parsing uses `encoding/json/v2` with `AllowDuplicateNames(true)` and `AllowInvalidUTF8(true)` to maximise compatibility with looser remote servers.

## Cross-connector relationships

The connector participates in remote relationships in two roles:

- **As source** (rs→db). Detected at planning time by `controller.buildRSRelationships` in `controller/controller.go` from the metadata's `remote_schemas[].remote_relationships[]`. The planner strips the relationship fields from the operation before the connector ever sees it (via the AST transformer with `relationshipLookup` populated from `IsRemote=true` rs→db entries). The connector executes the clean operation; the resolver then issues a follow-up DB query and stitches.
- **As target** (db→rs). The schema resolver (`controller/resolver/schema_resolver.go`) issues aliased fields against the connector. These come into `Execute` as a regular GraphQL operation — the connector does not need to know it was generated by the resolver.

`Connector.GetTypeName(identifier)` is called by the composer/resolver to resolve a remote root-field name (e.g. `countries`) to its base return type name (e.g. `Country`). The lookup goes through the admin schema, which is always populated from live introspection.

## SDL conversion details

`convertToGraphSchema` (`schema.go:47`) lowers gqlparser's `*ast.Schema` to `graph.Schema` — the same intermediate representation the SQL schema generator targets. This is what lets `connector/composer` and `connector/schemamerge` merge remote and local schemas uniformly.

Builtin types (`String`, `Int`, `Float`, `Boolean`, `ID`, and the `__*` introspection types — list in `prune.go:builtinTypes`) are skipped. Fields whose name starts with `__` are also filtered (`convertFields`); the schema-merge stage adds the standard introspection wiring back later.

## Failure modes worth knowing

| Failure | Where | Handled by |
|---|---|---|
| Bad URL in metadata | `meta.Definition.URL.Resolve()` | `New` returns error → controller fails reload |
| Endpoint unreachable at init | `introspectRemoteSchema` | `New` returns error → controller fails reload |
| SDL parse error for a role | `parseSDL` → `gqlparser.LoadSchema` | `buildRoleSchemas` returns error → role unusable |
| Non-200 response | `httpClient.do` | Wrapped error with status code + body |
| Remote returns `errors` array | `executeRemoteQuery` | `*GraphQLError` returned with data; controller merges |

## File reference

| File | Purpose |
|---|---|
| `connector/remoteschema/connector.go` | `Connector`, `New`, factories, `Execute` |
| `connector/remoteschema/introspect.go` | Live introspection query, conversion to `graph.Schema` |
| `connector/remoteschema/schema.go` | SDL parsing, `@preset` extraction, conversion to `graph.Schema` |
| `connector/remoteschema/prune.go` | Unreachable-type pruning, builtin filter |
| `connector/remoteschema/execute.go` | `applyPresets`, operation cloning, query rendering, HTTP request |
| `connector/remoteschema/http.go` | `httpClient`, header precedence, client-header forwarding, `HTTPDoer` |
| `connector/remoteschema/errors.go` | `GraphQLError` for partial responses with errors |
| `controller/controller.go:buildRSRelationships` | Lower rs→db metadata to planner shape |
| `controller/resolver/schema_resolver.go` | db→rs resolution (aliased fields) |

## See also

- [remote-relationships.md](./remote-relationships.md) — full mechanics of resolver dispatch.
- [customization.md](./customization.md) — how a remote schema's `definition.customization` (namespacing, type renaming) is applied and reversed.
- `docs/user/remote-schema.md` — operator-facing metadata reference.
- `connector/remoteschema/connector.go` package godoc — short summary of the package's role.
