# PostgreSQL Features

Constellation supports PostgreSQL as a database backend with a broad feature set inherited from the Hasura metadata model. This document maps each supported feature to the metadata that enables it, and notes which features are PostgreSQL-only versus shared with SQLite.

The PostgreSQL driver is wired in `connector/connector.go` based on `kind: postgres` in database metadata. Feature gates are expressed through the `Capabilities` struct (`connector/sql/graphql/schema/schema.go`) and the `Dialect` interface (`connector/sql/graphql/queries/dialect/dialect.go`).

## Database configuration

A database is declared in `databases/databases.yaml`:

```yaml
- name: default
  kind: postgres
  configuration:
    connection_info:
      database_url:
        from_env: HASURA_GRAPHQL_DATABASE_URL
  tables: '!include default/tables/tables.yaml'
  functions: '!include default/functions/functions.yaml'
```

- `kind: postgres` selects the PostgreSQL driver (pgx pool). The alternative is `kind: sqlite`. Any other value (`citus`, `mssql`, `bigquery`, …) fails at startup with `unsupported database kind`.
- `database_url` may be inlined or read from an environment variable via `from_env`. This is the only `connection_info` field Constellation reads.
- **Connection pooling is configured from the URL, not metadata.** Hasura's `pool_settings`, `isolation_level`, and `use_prepared_statements` blocks parse without error but are **ignored**. Tune the pool with connection-string parameters instead (pgx reads `?pool_max_conns=50&pool_max_conn_lifetime=1h&pool_max_conn_idle_time=30m`); Constellation also applies its own minimum floors. See [hasura-metadata-support.md](./hasura-metadata-support.md) for the full list of accepted-but-ignored fields.
- The driver installs a `constellation_throw_error(msg, code)` helper function at startup, used by permission post-checks.
- Multiple databases of either kind may coexist; `SchemaComposer` merges them into a single GraphQL schema per role.

## PostgreSQL capabilities

The Postgres dialect enables every capability flag (`connector/sql/graphql/queries/dialect/postgres.go`):

| Capability           | Postgres | SQLite | Effect on schema                                                                                          |
| -------------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `SupportsRegex`      | yes      | no     | Exposes `_regex`, `_iregex`, `_nregex`, `_niregex`, `_similar`, `_nsimilar` on text columns               |
| `SupportsJSONB`      | yes      | no     | Exposes JSONB comparison and mutation operators                                                           |
| `SupportsDistinctOn` | yes      | no     | Adds `distinct_on` argument on collection queries                                                         |
| `SupportsFunctions`  | yes      | no     | Exposes tracked SQL functions as queries/mutations/subscriptions                                          |
| `SupportsArrays`     | yes      | no     | Exposes array-typed columns and array comparison operators                                                |
| `SupportsLateral`    | yes      | no     | Generates `LEFT OUTER JOIN LATERAL` for nested relationships (SQLite falls back to correlated subqueries) |

When adding SQL generation, always go through the `Dialect` interface — never hardcode Postgres syntax. `JSONAggQuotedAlias(alias)` quotes the alias for use as a key name; `JSONAggRawExpr(expr)` takes a raw SQL expression.

## Tables

PostgreSQL introspection (`connector/sql/postgres/introspect.go`) discovers all non-system schemas and their tables, columns, primary keys, foreign keys, and unique constraints. Tables become visible to GraphQL only when listed in `tables.yaml` and individually tracked.

### Table metadata

```yaml
table:
  name: user_security_keys
  schema: auth
configuration:
  custom_name: authUserSecurityKeys
  custom_root_fields:
    select: authUserSecurityKeys
    select_by_pk: authUserSecurityKey
    select_aggregate: authUserSecurityKeysAggregate
    insert: insertAuthUserSecurityKeys
    insert_one: insertAuthUserSecurityKey
    update: updateAuthUserSecurityKeys
    update_by_pk: updateAuthUserSecurityKey
    delete: deleteAuthUserSecurityKeys
    delete_by_pk: deleteAuthUserSecurityKey
  column_config:
    user_id:
      custom_name: userId
is_enum: false
```

- `table.schema` is required; PostgreSQL supports multiple schemas (SQLite does not).
- `configuration.custom_name` renames the GraphQL type.
- `configuration.custom_root_fields` renames each generated root field.
- `configuration.column_config.<col>.custom_name` renames a column in the GraphQL schema.
- `is_enum: true` marks an enum-mapping table (see below).

### Columns

Columns are introspected with the following metadata:

| Field            | Source                             | Notes                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Name`           | `pg_attribute.attname`             | —                                                                                                                                                                                                                                                                                                                                         |
| `Type`           | `format_type(atttypid, atttypmod)` | Resolves domain types and aliases                                                                                                                                                                                                                                                                                                         |
| `IsNullable`     | `information_schema.columns`       | —                                                                                                                                                                                                                                                                                                                                         |
| `Default`        | `column_default`                   | Captures `nextval(...)` (sequences), `gen_random_uuid()`, `now()`, etc.                                                                                                                                                                                                                                                                   |
| `IsGenerated`    | `pg_attribute.attgenerated != ''`  | `GENERATED ALWAYS AS` columns; not insertable                                                                                                                                                                                                                                                                                             |
| `IsIdentity`     | `pg_attribute.attidentity != ''`   | `GENERATED [ALWAYS\|BY DEFAULT] AS IDENTITY` columns. Distinct from `IsGenerated`: the value is engine-assigned at INSERT time rather than computed from other columns, and insert-check predicates referencing the column run post-INSERT (against `RETURNING *`). SQLite's `INTEGER PRIMARY KEY` rowid alias is the cross-dialect twin. |
| `IsArray`        | `pg_type.typcategory = 'A'`        | Postgres-only                                                                                                                                                                                                                                                                                                                             |
| `SupportsMinMax` | derived from type                  | Drives `min`/`max` aggregates                                                                                                                                                                                                                                                                                                             |
| `SupportsInc`    | derived from type                  | Drives `_inc` update operator                                                                                                                                                                                                                                                                                                             |
| `SupportsAgg`    | derived from type                  | Drives numeric aggregates                                                                                                                                                                                                                                                                                                                 |
| `Comment`        | `pg_description`                   | Surfaced as field description                                                                                                                                                                                                                                                                                                             |

### Views and materialized views

Views and materialized views are introspected through the same `information_schema.columns` query used for tables — there is no special handling and no `is_view` flag. Track them in `tables.yaml` exactly like a table:

```yaml
table:
  name: active_users
  schema: public
configuration:
  custom_name: activeUsers
select_permissions:
  - role: user
    permission:
      columns: [id, name]
      filter: {}
```

Caveats:

- **No primary key, no foreign keys.** Views don't appear in `pg_constraint`/`pg_index`, so `<view>_by_pk` is not generated and FK-based relationships cannot be auto-detected. Use `manual_configuration` to declare relationships against views.
- **Mutations are best-effort.** `insert_<view>`, `update_<view>`, `delete_<view>` are generated, but the SQL runs against the view at execution time — PostgreSQL will reject the mutation unless the view is auto-updatable or has `INSTEAD OF` triggers. Materialized views are not writable at all.
- **No upsert.** `on_conflict` requires an introspected constraint and is omitted when none exist.
- **No write permissions.** Configure only `select_permissions` for matviews and non-updatable views; the other permission blocks will generate fields that fail at runtime.

### Enum tables

A table marked `is_enum: true` becomes a GraphQL enum. Enum values are loaded from the table data at introspection time (`introspectEnumValues` in `connector/sql/postgres/introspect.go`). The table must have one primary key column (the value) and may have one optional second column (the description). No other columns are allowed (`connector/sql/introspection/object.go`).

Native PostgreSQL `pg_enum` types are also supported as column types — values are read from `pg_enum` and emitted as GraphQL enum types.

## Relationships

Three relationship kinds are supported. All are declared on the parent table.

### Object relationships (many-to-one)

```yaml
object_relationships:
  - name: user
    using:
      foreign_key_constraint_on: user_id
```

Alternative forms:

```yaml
# Foreign key declared on the other table pointing back to this one
- name: profile
  using:
    foreign_key_constraint_on:
      column: user_id
      table: { name: profiles, schema: public }

# Manual mapping (no FK)
- name: organization
  using:
    manual_configuration:
      remote_table: { name: organizations, schema: public }
      column_mapping:
        org_id: id
```

> **Single-column and composite foreign keys use the same constraint-selection
> rule.** Use a column name or an array such as
> `foreign_key_constraint_on: [organization_id, user_id]` when the foreign key
> is on the parent table. When it is on the other table, use an object with
> `column` or `columns` plus `table`. For every form, Constellation first looks
> for one introspected constraint whose column set exactly matches the configured
> column or columns and preserves the configured order when pairing the join. If
> no exact constraint is available, it falls back to the first introspected
> foreign-key match for each configured column. Every column must resolve, and
> parent-table forms must resolve to one target table.

### Array relationships (one-to-many)

```yaml
array_relationships:
  - name: sessions
    using:
      foreign_key_constraint_on:
        column: user_id
        table: { name: sessions, schema: auth }
```

### Remote relationships

Cross-database and remote-schema relationships are resolved post-execution by `controller/resolver/` after the primary connector returns. Two targets: another database source, or a remote GraphQL schema.

```yaml
remote_relationships:
  - name: orders
    definition:
      to_source:
        source: warehouse
        table: { name: orders, schema: public }
        relationship_type: array # or "object"
        field_mapping:
          id: customer_id
```

```yaml
remote_relationships:
  - name: weather
    definition:
      to_remote_schema:
        remote_schema: weather_api
        lhs_fields: [city]
        remote_field:
          forecast:
            arguments:
              city: $city
```

## Permissions

Per-role permissions are declared per table. The admin role bypasses permissions and always sees the full schema.

```yaml
select_permissions:
  - role: user
    permission:
      columns: [id, name, email]
      filter:
        id: { _eq: X-Hasura-User-Id }
      allow_aggregations: true

insert_permissions:
  - role: user
    permission:
      columns: [name, email]
      check:
        id: { _eq: X-Hasura-User-Id }
      set:
        created_by: X-Hasura-User-Id

update_permissions:
  - role: user
    permission:
      columns: [name]
      filter:
        id: { _eq: X-Hasura-User-Id }
      check:
        id: { _eq: X-Hasura-User-Id }

delete_permissions:
  - role: user
    permission:
      filter:
        id: { _eq: X-Hasura-User-Id }
```

- `filter` is a pre-condition (applied as `WHERE`).
- `check` is a post-condition (applied to the row after the operation; enforced via `RETURNING` and `constellation_throw_error`).
- Session variables of the form `X-Hasura-*` are extracted from request headers or JWT Hasura claims by `controller/middleware/`.
- `_eq: X-Hasura-User-Id` substitutes the session variable as a parameterized SQL value.
- `set` (insert/update) writes column presets — including session variables — on every affected row.
- **Not enforced:** a per-role `limit` on select permissions, plus `query_root_fields`, `subscription_root_fields`, `backend_only`, and `validate_input`. Scalar computed fields with supported non-array BASE returns and arguments are available in row selections (including mutation `returning` and subscriptions) when granted to the role. Unnamed user arguments count from `arg_1` after excluding row/session and named arguments. Non-BASE, array and unclassified scalar SETOF returns invalidate definitions and granting permissions; domain/enum/composite/range/multirange arguments and arrays (including user-defined element types) are accepted as string-only custom GraphQL scalars (or null), with parameterized PostgreSQL casts. Non-public custom types execute in Constellation even when pinned Hasura v2.50.3-ce errors; see [known differences](../../KNOWN_DIFFERENCES.md). Scalar computed fields with no user arguments are usable in `where`/`order_by` inputs across query, mutation and subscription contexts. Comparable scalar returns appear in aggregate `min`/`max`; numeric returns appear in `sum`, `avg`, `stddev`, `stddev_pop`, `stddev_samp`, `var_pop`, `var_samp` and `variance`, retaining `args` and the function return type. Hasura exposes neither argument-bearing fields in row `where`/`order_by` nor scalar computed fields in aggregate-order inputs. `SETOF` tracked-table computed fields are selectable as nullable lists of non-null target rows (without an aggregate sibling) when the returned table has select access. Their `args`, `where`, `order_by`, `distinct_on`, `limit` and `offset` run within the correlated function result; target row/column permissions also apply. Argument-free table-valued computed functions also appear in row `bool_exp` (EXISTS) and `<field>_aggregate` order inputs: these user inputs apply the returned table's select permissions, including its row filter (as in patched Hasura v2.50.3-ce). Argument-free scalar and table predicates are enforced in select/update/delete filters and insert/update checks independently of selection grants (including relationship and `_exists` traversal and per-session values). Relationship-aggregate permission keys are rejected by Hasura; identifiable computed references inside them remain fail-closed. Invalid grants and permissions with identifiable invalid or unexecutable computed predicates are removed as whole permissions and reported inconsistent, never served with their filter/check stripped. No-user-argument **non-SETOF** scalar computed fields can also be LHS keys in remote `to_source` object/array joins (matching text or JSONB target columns, including JSON objects, strings, numbers and arrays) or text→remote-schema `ID!` joins, including session-bound functions. The key's select grant is required per role; absent grants omit the relationship from role SDL, a deliberate difference from Hasura's denied-key joining. For computed `to_source` keys the target join column must be selectable, unlike Hasura's join through a denied target column (an equality oracle); target row filters still apply. Physical-key relationships do not use these computed-key authorization gates; JSONB targets bind typed JSON values for object/array joins, including physical keys whose target column is role-hidden; JSONB array `_aggregate` siblings bind and stitch typed keys for computed and physical JSONB keys. PostgreSQL `json` target columns have no `json = json` operator: ordinary and grouped joins into them fail at execution, as in Hasura’s equality join. GeoJSON object keys are also JSON-encoded, fixing physical geometry joins. Argument-bearing, table-valued and scalar `SETOF` keys and all JSON/JSONB computed keys toward remote schemas are unavailable regardless of remote argument type. Scalar `SETOF`-keyed relationships are omitted for every role, including admin, without an inconsistency. A restored pinned-Hasura probe served a `SETOF text`-keyed `to_source` object relationship even for ungranted roles; Constellation deliberately omits it to avoid a role-hidden or multi-valued key. Other SETOF join-key forms were not probed. See [hasura-metadata-support.md](./hasura-metadata-support.md) and [known differences](../../KNOWN_DIFFERENCES.md).

### Computed fields on tracked tables

On PostgreSQL, table-owned `computed_fields` call non-volatile row-bound functions in selections. Scalar fields require explicit per-role select grants; `SETOF` and single-composite tracked-table fields derive access from the returned table's row and column select permissions. An explicit computed-field grant for a table return invalidates that role's select permission. The independently tested `SETOF text`, `numeric`, `int4`, `float8`, `bool`, `date`, `uuid`, `jsonb` and installed `public.citext` returns are nullable scalars; zero-cardinality direct selections yield a null parent and multi-row direct selections fail. Even zero/one-row `where` filters error at the database; `order_by` omits zero-cardinality parents and can duplicate multi-row parents, while numeric `max` reduces returned values. In mutation returning, a zero-row scalar yields a null single-object result or a null element per affected row in collection `returning`, while the successful write persists. A multi-row scalar raises SQLSTATE 21000 and rolls back all writes in that same-source mutation (production clients receive the inherited sanitized error, not its SQLSTATE). Table-return `SETOF` yields a list (including `[]` for zero rows), while a missing single composite may yield an all-null list element. When a scalar SETOF aggregate is selected, `count`, physical-column aggregates, computed operands and `nodes` all read the same expanded rows, including aliases, nested aggregates and grouped per-key windows; multiple SETOF operands expand in lockstep. Eligible aggregates operate on those flattened return rows; advertised UUID max/min fail with 42883 where PostgreSQL has no such aggregate (also on pinned Hasura), while boolean/JSONB have no aggregate fields. Vector, spatial, array and other untested BASE scalar `SETOF` kinds remain gated. When a computed name equals an array relationship's `<rel>_aggregate` sibling, Constellation omits only the ambiguous computed selection/grant and reports it inconsistent, retaining the genuine relationship/aggregate and role roots; pinned Hasura v2.50.3-ce emits duplicate row/order input names instead (see [known differences](../../KNOWN_DIFFERENCES.md)). Argument-free scalar and table functions can also participate in the supported `where`/`order_by` and metadata permission predicates; argument-bearing fields are selection-only. Invalid definitions and identifiable invalid permission predicates fail closed at field or whole-permission granularity (see [inconsistencies](./inconsistencies.md)). Non-BASE **return** types and array returns (including catalog-BASE `text[]`) remain invalid; scalar SETOF returns outside the explicitly classified kinds are also invalid. Domain, enum, composite, range, multirange and array **arguments** (including user-defined element types) are available as string-only scalars, with composite inputs named `<type>_scalar`. Constellation binds inputs through schema-qualified casts; pinned Hasura v2.50.3-ce fails at runtime for accepted non-public custom types even though its public-domain control succeeds (see [known differences](../../KNOWN_DIFFERENCES.md)). SQLite does not serve computed fields. Constellation retains its inherited production database-error sanitizer (dev mode returns the raw error chain, without Hasura's `extensions.code`/`path`) and strict GraphQL Int validation for both physical columns and computed arguments. In particular, Hasura v2.50.3-ce **accepts and executes quoted-string Int inputs** where Constellation rejects them; float and out-of-range Int error envelopes also differ. The HTTP/controller column-and-computed controls and precise limits are in [known differences](../../KNOWN_DIFFERENCES.md#inherited-database-error-sanitization-and-strict-int-inputs-approved-phase-14). Metadata add/drop operations still belong to the existing Hasura engine, not the Constellation request path. See the [metadata support matrix](./hasura-metadata-support.md) for the exact supported forms and the [alpha contract inventory](../developers/computed-fields.md) for independent test coverage and open gaps.

## Queries

Each tracked table produces three root query fields (names overridable via `custom_root_fields`):

- `<table>` — collection query with `where`, `order_by`, `limit`, `offset`, `distinct_on`.
- `<table>_by_pk` — single-row lookup by primary key.
- `<table>_aggregate` — aggregates over the same filter set.

### Filter operators

Boolean expression operators per column type (`connector/sql/graphql/schema/inputs.go`):

| Operator group        | Operators                                                                           | Availability                             |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| Equality / comparison | `_eq`, `_neq`, `_in`, `_nin`, `_is_null`, `_gt`, `_gte`, `_lt`, `_lte`              | All columns                              |
| Text patterns         | `_like`, `_nlike`, `_ilike`, `_nilike`                                              | Text columns                             |
| Regex (Postgres)      | `_regex`, `_iregex`, `_nregex`, `_niregex`, `_similar`, `_nsimilar`                 | Text columns, gated by `SupportsRegex`   |
| JSONB (Postgres)      | `_contains`, `_contained_in`, `_has_key`, `_has_keys_all`, `_has_keys_any`, `_cast` | JSONB columns, gated by `SupportsJSONB`  |
| Array (Postgres)      | `_contains`, `_contained_in`                                                        | Array columns, gated by `SupportsArrays` |

The `_cast` operator wraps a nested boolean expression on the casted scalar type (e.g., `{ data: { _cast: { String: { _ilike: "%foo%" } } } }`).

For PostGIS `geometry` and `geography` columns, `_eq` and `_neq` use the PostGIS `=` semantics. On `geometry` this compares bounding boxes rather than exact geometry equality; use `_st_equals` when you need exact topological equality for geometry values. Spatial `_neq` is emitted as `NOT (<column> = <value>)` for compatibility with PostGIS versions whose `<>`/`!=` geometry operator cannot be resolved.

### `distinct_on`

Postgres-only argument that lists columns for `SELECT DISTINCT ON (...)`. Gated by `SupportsDistinctOn`.

## Mutations

Each tracked table produces (names overridable):

- `insert_<table>` — bulk insert, returns `{ affected_rows, returning }`.
- `insert_<table>_one` — single insert, returns the row.
- `update_<table>` — bulk update with `where`.
- `update_<table>_by_pk` — single update by primary key.
- `update_<table>_many` — sequential per-row updates with individual filters.
- `delete_<table>` — bulk delete with `where`.
- `delete_<table>_by_pk` — single delete by primary key.

### Update operators

| Operator          | Applies to      | Notes                                                    |
| ----------------- | --------------- | -------------------------------------------------------- |
| `_set`            | any column      | Always available                                         |
| `_inc`            | numeric columns | Generated when at least one column reports `SupportsInc` |
| `_append`         | JSONB columns   | Postgres-only; `\|\|` append                             |
| `_prepend`        | JSONB columns   | Postgres-only; `\|\|` prepend                            |
| `_delete_key`     | JSONB columns   | Postgres-only; `- text`                                  |
| `_delete_elem`    | JSONB columns   | Postgres-only; `- int`                                   |
| `_delete_at_path` | JSONB columns   | Postgres-only; `#- text[]`                               |

JSONB mutation operators are produced only when the table has at least one JSONB column.

### Upsert (`on_conflict`)

Available when the table has a primary key or unique constraint. The argument structure is:

```graphql
insert_users(
  objects: [{ id: "...", name: "..." }],
  on_conflict: {
    constraint: users_pkey,
    update_columns: [name],
    where: { name: { _neq: "" } }
  }
)
```

- `constraint` is one of the introspected unique/primary key constraints.
- `update_columns: []` becomes `ON CONFLICT ... DO NOTHING`.
- `where` is optional and scopes the `DO UPDATE`.

Generated SQL: `ON CONFLICT ON CONSTRAINT "<name>" DO UPDATE SET col = EXCLUDED.col [WHERE ...]`. Implementation: `connector/sql/graphql/queries/mutation_insert_on_conflict.go`.

For a non-admin role, the permission check applied to each row depends on the
branch that row took, matching Hasura: a freshly inserted row must satisfy the
role's INSERT `check`, while a row that took the `DO UPDATE` branch is governed
by the role's UPDATE `filter` and UPDATE `check` instead — the INSERT check is
not applied to it. PostgreSQL classifies each `RETURNING` row exactly using the
internal `xmax` marker, so the selection is per-row even when the conflict key
is database-generated or supplied by a default. See
`connector/sql/graphql/queries/mutation_insert_check_ctes.go` (the post-mutation
check path used by PostgreSQL upserts with an INSERT check). SQLite sources do
not have executable write-mutation support yet — insert, upsert, update, and
delete all fail at runtime because the data-modifying-CTE shape they share is a
PostgreSQL extension SQLite rejects; see
[SQLite source differences](sqlite.md) for the full list and root cause.

## Subscriptions

Subscriptions are polling-based for both Postgres and SQLite (no LISTEN/NOTIFY). The handler (`connector/sql/subscription/`) groups subscriptions with identical query shapes into cohorts of up to 100 and executes one multiplexed query per cohort per poll interval. Change detection uses xxhash on each subscriber's result; updates are pushed only when the hash changes.

Per-table subscription fields mirror the queries:

- `<table>` — collection subscription.
- `<table>_by_pk` — single-row subscription.
- `<table>_aggregate` — aggregate subscription.
- `<table>_stream` — cursor-based streaming subscription (PostgreSQL); emits incremental batches ordered by a cursor column.

Multiplexed queries use `UNNEST($1::text[], $2::json[])` to bind per-subscriber variables — this requires Postgres (the SQLite handler uses a different multiplexing scheme).

## Aggregates

`<table>_aggregate` returns:

```graphql
{
  aggregate {
    count(columns: [...], distinct: true)
    min { ... }       # comparable columns
    max { ... }       # comparable columns
    avg { ... }       # numeric columns
    sum { ... }
    stddev { ... }
    stddev_pop { ... }
    stddev_samp { ... }
    var_pop { ... }
    var_samp { ... }
    variance { ... }
  }
  nodes { ... }
}
```

Numeric aggregates are emitted only when the table has at least one numeric column.

Array relationships also support aggregate filtering through `<rel>_aggregate` boolean expressions:

```graphql
where: {
  posts_aggregate: {
    count: { predicate: { _gt: 5 }, filter: { published: { _eq: true } } }
  }
}
```

When boolean columns are present, the aggregate bool expression also exposes `bool_and` and `bool_or` over those columns.

## Functions

Tracked PostgreSQL functions are introspected from `pg_proc` (`connector/sql/postgres/introspect_functions.go`). Functions must return a table type or `SETOF` a composite type to be tracked.

### Function metadata

```yaml
function:
  name: search_articles
  schema: public
configuration:
  custom_name: searchArticles
  custom_root_fields:
    function: searchArticles
    function_aggregate: searchArticlesAggregate
  session_argument: hasura_session
  exposed_as: query # or "mutation"
permissions:
  - role: user
```

- `session_argument`: name of a function argument that receives session variables as JSON. The argument is hidden from the GraphQL schema and injected automatically.
- `exposed_as`: defaults to `query` for `IMMUTABLE`/`STABLE` functions and `mutation` for `VOLATILE`. Override here.
- `permissions`: list of roles allowed to call the function.

### Generated GraphQL fields

For a function returning a table type:

- `<function>` — collection query/subscription/mutation (depending on `exposed_as`).
- `<function>_aggregate` — aggregate over the result set.
- `<function>_by_pk` — when the returned type has a primary key (composite-type return).

Function arguments become GraphQL arguments. Arguments with `pronargdefaults` (default values) become optional. The `session_argument` is omitted from the public schema.

## Remote schemas

See [`remote-schema.md`](./remote-schema.md). Remote schemas are configured per role with an SDL document, and `@preset(value: "...")` directives inject session variables or literals into hidden arguments.

## Feature support matrix

| Feature                                                                  | Postgres                                                                 | SQLite                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Multiple schemas per database                                            | yes                                                                      | no (single schema)                                                                                             |
| `distinct_on`                                                            | yes                                                                      | no                                                                                                             |
| Regex operators                                                          | yes                                                                      | no                                                                                                             |
| JSONB comparison operators                                               | yes                                                                      | no                                                                                                             |
| JSONB mutation operators (`_append`, etc.)                               | yes                                                                      | no                                                                                                             |
| Array columns and `_contains` / `_contained_in`                          | yes                                                                      | no                                                                                                             |
| `ILIKE`                                                                  | yes                                                                      | yes (ASCII case-folding via `LOWER(...) LIKE LOWER(...)`)                                                      |
| Generated columns                                                        | yes                                                                      | no                                                                                                             |
| Identity columns                                                         | yes (`GENERATED AS IDENTITY`)                                            | yes (`INTEGER PRIMARY KEY` rowid alias)                                                                        |
| `gen_random_uuid()` / sequence defaults                                  | yes                                                                      | partial                                                                                                        |
| `pg_enum` types                                                          | yes                                                                      | no                                                                                                             |
| Views (read)                                                             | yes (track as table)                                                     | yes (track as table)                                                                                           |
| Views (write)                                                            | only auto-updatable / `INSTEAD OF`                                       | no — generated for `INSTEAD OF`-trigger views but fail at runtime (see [SQLite source differences](sqlite.md)) |
| Materialized views (read)                                                | yes (track as table)                                                     | n/a (SQLite has no matviews)                                                                                   |
| Tracked SQL functions                                                    | yes                                                                      | no                                                                                                             |
| Function volatility (IMMUTABLE / STABLE / VOLATILE)                      | yes                                                                      | n/a                                                                                                            |
| `LATERAL` joins for nested relations                                     | yes                                                                      | correlated subqueries                                                                                          |
| Write mutations (`insert` / `update` / `delete`, all variants)           | yes                                                                      | no — fields generated but fail at runtime (see [SQLite source differences](sqlite.md))                         |
| `ON CONFLICT` upserts                                                    | yes                                                                      | no                                                                                                             |
| `RETURNING`                                                              | yes                                                                      | no                                                                                                             |
| Data-modifying CTEs (`WITH ... AS (INSERT/UPDATE/DELETE ... RETURNING)`) | yes                                                                      | no                                                                                                             |
| Stream subscriptions                                                     | yes                                                                      | yes                                                                                                            |
| Aggregates                                                               | yes (`count`, `min`, `max`, `avg`, `sum`, `stddev*`, `var*`, `variance`) | partial (`count`, `min`, `max`, `avg`, `sum`; no `stddev*` / `var*` / `variance`)                              |
| Object / array / remote relationships                                    | yes                                                                      | yes                                                                                                            |
| Per-role permissions with session variables                              | yes                                                                      | yes                                                                                                            |
| Enum-mapping tables (`is_enum`)                                          | yes                                                                      | yes                                                                                                            |

## Implementation pointers

| Topic                    | File                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| Capability gates         | `connector/sql/graphql/schema/schema.go`                                   |
| Postgres dialect         | `connector/sql/graphql/queries/dialect/postgres.go`                        |
| Postgres driver          | `connector/sql/postgres/postgres.go`                                       |
| Schema introspection     | `connector/sql/postgres/introspect.go`                                     |
| Function introspection   | `connector/sql/postgres/introspect_functions.go`                           |
| Comparison operators     | `connector/sql/graphql/schema/inputs.go`                                   |
| Update operators         | `connector/sql/graphql/schema/update.go`                                   |
| JSONB mutation operators | `connector/sql/graphql/schema/mutation.go`                                 |
| `ON CONFLICT` codegen    | `connector/sql/graphql/queries/mutation_insert_on_conflict.go`             |
| Aggregates               | `connector/sql/graphql/schema/aggregate.go`                                |
| Subscription cohorts     | `connector/sql/subscription/`                                              |
| Metadata types           | `metadata/` (`database.go`, `table.go`, `function.go`, `remote_schema.go`) |
