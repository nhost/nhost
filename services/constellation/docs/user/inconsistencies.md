# Metadata Inconsistencies

Constellation does not refuse to start when a metadata document is partly out of
sync with the underlying source. Every entity that fails to load is recorded as
an **inconsistency** and dropped from the live schema; the surrounding source,
role, table, or column keeps serving. This document lists every category of
inconsistency Constellation detects, what it drops, and what survives.

> The current build records inconsistencies internally and logs each one at
> `WARN` level with a one-line summary on every successful build/reload. An
> HTTP endpoint to inspect them at runtime is planned; the structure of each
> entry — `kind`, `source`, `name`, `reason`, `at` — already matches what that
> endpoint will return.

## What is non-fatal vs. fatal

Constellation only refuses to come up when it **cannot read the metadata
document at all** — i.e. the file source can't open the directory, the database
source can't read `hdb_catalog`, or the parser rejects the bytes as malformed.
Once a metadata document is in hand, every later failure becomes a recorded
inconsistency and the server keeps running with whatever did load.

| Phase | Fatal? | Notes |
|---|---|---|
| Loading metadata bytes from file/db | **Yes on initial load, No on reload** | Initial load wraps with `initial metadata load: …` and aborts startup. Reload errors are logged as `metadata reload failed, keeping current state` and the previous state continues serving. |
| Parsing metadata bytes into types | **Yes on initial load, No on reload** | Same paths as above. |
| Building a source connector (factory error, customization rejection) | No | Whole source dropped, recorded as `database` or `remote_schema`. |
| Reconciling metadata against introspected source objects | No | Per-entity drops, recorded as `table` / `column` / `function` / `relationship` / `enum_values` / `computed_field` / `<operation>_permission`. |
| Composing per-role schemas | No | Whole role dropped on validation/merge failure, recorded as `role`. |

## Inconsistency kinds

Each entry below names the `kind` value emitted, what triggers it, and what is
dropped vs. what keeps serving.

### `database` (PostgreSQL / SQLite source)

Recorded when a database source listed in metadata cannot be built. Triggers:

* `Kind` is not in the supported set (currently `postgres` and `sqlite`).
* The connection URL fails to resolve (unresolved env var, empty value).
* The driver fails to open the pool / connect.
* Source-level customization rejects an unsupported feature (e.g.
  per-type `field_names`).

**Effect:** the entire source is omitted from the composed schema. Other
sources and remote schemas continue serving. Requests addressed to this
source's roles fall through to "no schema available for role" if no other
source covers them.

### `remote_schema`

Recorded when a remote-schema source listed in metadata cannot be built.
Triggers:

* The introspection HTTP call fails.
* Remote-schema customization rejects an unsupported feature.

**Effect:** the entire remote schema is omitted. Other sources serve as
normal.

### `table` (PostgreSQL / SQLite source)

Recorded when metadata tracks `schema.table` but the source has no such
relation. Detected by reconciling metadata against the introspected objects
returned by the driver.

**Effect:** the offending table is removed from the source's effective
metadata. Every other table in the source keeps serving with its full schema,
permissions, and relationships intact. Local relationships (object/array)
pointing at the dropped table are recorded separately as `relationship`
inconsistencies and removed too.

### `column` (PostgreSQL / SQLite source)

Recorded when a column name in metadata references a column that does not
exist on the introspected table. The reconciler checks the following sites:

| Where the reference lives | What gets dropped |
|---|---|
| `configuration.column_config` keys | the offending key (and its `custom_name`) |
| `select_permissions[*].permission.columns` | the offending entry in the list |
| `insert_permissions[*].permission.columns` | the offending entry in the list |
| `insert_permissions[*].permission.set` keys | the offending key and its value |
| `update_permissions[*].permission.columns` | the offending entry in the list |
| `update_permissions[*].permission.set` keys | the offending key and its value |

**Effect:** only the missing reference is dropped. Every other column on the
table — and every other permission entry — keeps serving. The table itself is
unaffected.

> **What is *not* checked:** ordinary missing column references inside
> `filter` / `check` expressions are not reconciled per permission. The
> existing permission parser can reject them during root construction,
> dropping the source; this is distinct from a known computed-field reference.
> On PostgreSQL, malformed `_exists` values, table references and `_where` maps,
> or untracked targets, are checked per permission even without computed fields;
> unknown keys inside a valid `_where` keep the existing parser behavior.

### `computed_field` and `<operation>_permission` (PostgreSQL source)

An invalid table-owned computed definition (malformed wire entry, missing or
ambiguous function, missing or non-IN row argument, volatile function,
unsupported return or argument type kind, untracked SETOF composite target,
non-IN non-row argument, field-name collision, or exposed computed argument name
that is not a GraphQL identifier, begins with reserved `__`, or duplicates
another exposed name, including a generated `arg_N`) is recorded as
`computed_field` and removed **individually**. Hidden row/session argument
names are not checked. Non-array PostgreSQL BASE scalar returns include
extension types outside `pg_catalog`, but `SETOF` scalar returns are enabled
only for independently classified `pg_catalog.text`, `numeric`, `int4`,
`float8`, `bool`, `date`, `uuid`, `jsonb` and installed `public.citext`.
Arrays (including `text[]`, despite catalog `typtype = 'b'`) and unclassified
`SETOF` base returns are invalid; a role granting one loses its entire select
permission. Domain, enum, range and multirange **returns** are also invalid.
BASE non-row arguments are accepted; pseudo-type arguments are rejected.
Domain, enum, range, multirange, composite and array **arguments** (including
user-defined element types) are exposed as string-only custom scalars;
composites use `<type>_scalar`. Values or nulls use bound, qualified
PostgreSQL casts, and invalid values fail at the database.
Manual table-valued grants remain invalid regardless of argument kind.
A computed definition on SQLite is ignored as before, without computed-specific
inconsistencies or grant revocation. Other fields and tables survive. Valid
PostgreSQL scalar selections and argument-free computed user predicates
and ordering are available to admin and granted roles; argument-free scalar
computed permission filters/checks execute without a selection grant. PostgreSQL
`SETOF` tracked-table selections are available to roles with select access on
the returned table, without a computed grant; that table's row filters and
column permissions apply to the returned rows. Argument-free table functions
also appear in row `bool_exp` as an EXISTS over the function result and in
`order_by` as `<field>_aggregate` (without a selection aggregate sibling).
User predicates and aggregate ordering apply the returned table's row and
column permissions, including its select row filter (matching patched Hasura
v2.50.3-ce). Metadata permission predicates instead evaluate independently
of the target select grant and filter. Role select/update/delete filters and insert/update checks
may use argument-free table predicates without a select grant on the returned
table; their predicate sees the full function result, as in Hasura. An
identifiable invalid, argument-bearing or unexecutable table predicate removes
its entire affected permission.

A select permission with an invalid/malformed computed grant is recorded as
`select_permission` and removed **in its entirety**, including its filter;
manual table-valued grants are invalid because target-table permissions derive
them. A valid scalar grant exposes its executable selection, including supported
custom argument scalars; an ungranted role sees neither the field nor its
private `_args` input type. A computed `_args` input that differs from a
composed input of the same name, or a computed `_args` input or argument scalar
whose name conflicts with a non-scalar composed type, drops just the affected
selection and records a `computed_field`
inconsistency; the role and other fields remain. If the omitted selection was
an aggregate family's only operand, its now-empty output type and the
corresponding aggregate field are also removed; `count`, other aggregate
families and `nodes` remain. Hasura v2.50.3-ce instead atomically rejects
the probed PUBLIC argument enum versus tracked-row object collision and
both cross-source and same-source differing `_args` inputs (including a
tracked root function's input), even with `allow_inconsistent_metadata: true`.
A same-source collision keeps the tracked function's root and input, and records
one computed-field inconsistency per affected field and role. Constellation's
metadata acceptance and narrow fail-closed omission are an approved difference,
not metadata parity.
An exact computed `<rel>_aggregate` array-relationship sibling collision
also omits only the ambiguous computed field and its grant, retaining the
select permission and genuine relationship; Hasura exposes duplicate names.
An argument-free table computed field `X` whose synthesized order key
`X_aggregate` collides with a column/custom column name, object relationship
or argument-free scalar computed field is omitted individually as a
`computed_field` inconsistency. Its selection, EXISTS predicate and aggregate
order input disappear, while the genuine field's order input and unrelated
roles survive. A permission predicate depending on the removed field is
invalidated rather than silently ignored. Hasura v2.50.3-ce accepts these
names, keeps `X` selectable and the roles available, but publishes duplicate
order inputs; neither use of `X_aggregate` works. Constellation drops the
ambiguous field to retain a valid schema and the genuine order input. An array
relationship named `X_aggregate` does not create this conflict: its generated
order key is `X_aggregate_aggregate`. Only the column's effective GraphQL
name participates: a physical `X_aggregate` column renamed with `custom_name`
to another name does not collide. Argument-bearing table fields generate
no aggregate-order input. This does not make manual table-valued grants valid;
the earlier sibling and argument-type omissions remain exceptions to the usual
invalid-grant rule for ordinary invalid computed definitions. A select/update/delete filter or insert/update check referencing a valid,
argument-free PostgreSQL scalar or table computed field is enforced, including
through logical operators, local relationships and `_exists`.
On PostgreSQL, `_exists._table` accepts a bare name or an object with an
optional schema; omitted and `null` schemas mean `public`, not the containing
table's schema. An invalid `_exists` value, table reference, `_where` map or
untracked target revokes only the containing permission, including for
computed-free predicates. An identifiable invalid or unexecutable computed
reference is likewise recorded as `<operation>_permission` and the **entire
affected permission** is removed, not just its filter/check.
Hasura rejects relationship-aggregate permission keys; identifiable computed
references inside them revoke the affected permission. Non-computed aggregate
permission keys retain their existing parser behavior. Other roles
and permissions on the same table remain available. A definition or a grant
(on any role of that table) identifies a computed predicate, including if its
function is missing. An unknown key with neither a definition nor a grant is
not classified by its spelling. For example, a `missing_computed` filter without
a matching definition or grant is an ordinary unknown key to Constellation:
root construction fails and the **whole database source** is unavailable, even
though Hasura marks only its `select_permission` inconsistent. A filter with an ordinary
missing-column key has the same source-wide outcome in Constellation, including
an unknown key inside a valid `_exists._where` outside a recognized computed-table
predicate. This is an intentional, documented difference for invalid metadata, not supported
computed-field parity; do not use unknown filter keys as an access-control
mechanism.

### `function` (PostgreSQL source)

Recorded when metadata tracks a function whose `schema.name` is not present in
the introspected `pg_proc` set.

**Effect:** the function is dropped from the source's effective metadata. The
rest of the source keeps serving. SQLite does not expose functions; this kind
applies only to PostgreSQL sources.

### `relationship` (PostgreSQL / SQLite source)

Recorded when an `object_relationships` or `array_relationships` entry targets
a table that does not exist in the same source, or when a Hasura
`remote_relationships[].definition.to_source.relationship_type` value is
missing or not one of `object` / `array`. Detected by checking
`using.foreign_key_constraint.table` and
`using.manual_configuration.remote_table` against the surviving table set, and
by validating raw `to_source` remote relationship type discriminators.

**Cross-source relationships** (`manual_configuration.source` pointing at a
different source name) are *not* validated here — the composer's
`remote_relationships` layer is responsible for those.

**Effect:** the relationship is removed from the table it lives on. Every
other relationship on the same table, and the table itself, keep serving.

### `enum_values` (PostgreSQL / SQLite source)

Recorded when a table is flagged `is_enum: true`, **exists in the source**,
but cannot be exposed as a GraphQL enum because no usable values came back
from the driver. Triggers:

* The table has more than two columns, or no primary key (invalid enum
  shape).
* The query against the enum table failed (e.g. permissions on the role
  Constellation connects as cannot read it).
* The table is valid but contains zero rows.

**Effect:** the table is **dropped from the source entirely** — matching
Hasura. Demoting it to a regular table would silently widen the input
contract for every FK column pointing at it (a mutation that used to reject
`status: "WHATEVER"` would now accept any string), and a row deletion in
production could swap the type without any visible signal at the GraphQL
layer. Dropping the table makes the failure loud at the schema surface.

`enum_values` is recorded as a distinct kind from `table` so operators can
filter on "this table failed specifically because it was misconfigured as an
enum" rather than the general "table not found" case.

The same cascade described under [`table`](#table-postgresql--sqlite-source)
applies here: local object/array relationships targeting the dropped enum
table are removed and recorded as `relationship` inconsistencies. FK columns
on *other* tables that point at the dropped enum table remain in the schema
as plain scalars — they keep their underlying type but lose any `_enum`
input type and the implicit value constraint that would have come with the
enum.

> **Not in this bucket:** a missing-from-source enum table produces a
> [`table`](#table-postgresql--sqlite-source) inconsistency instead — the
> "table not in source" check runs first, so the enum-specific path is only
> reached for tables that physically exist.

### `role`

Recorded when schema composition fails for a specific role. Triggers:

* `connector/schemamerge.MergeConnectorSchema` rejects an incoming connector's
  schema (duplicate field/type with incompatible shape, conflicting enums,
  conflicting `_comparison_exp` inputs).
* `BuildValidatedSchema` rejects the merged schema for the role (any
  GraphQL-spec violation that survived merging).

**Effect:** only that role is dropped from `validatedSchemas`. Requests for
that role get the standard "no schema available for role: X" response. Other
roles continue serving with the connectors that did merge successfully.

## Reload and export timing

A successful metadata reload builds new effective computed fields, role schemas, SQL roots and inconsistencies together before swapping the served state. A failed reload keeps the previous served state. On a polled database source, native `export_metadata` instead reads the latest **raw** metadata snapshot: it may include a newly invalid computed definition or grant before the served state changes. When a Hasura upstream is configured, export and metadata writes are proxied upstream, not served from this snapshot. Do not use export's resource version as evidence of the current role schema; verify role introspection and a representative query after reload. File-source export is best-effort, not an exact copy of unknown metadata keys.

## How inconsistencies surface today

Per-entry: each `Record` call emits a `WARN` log line with fields `kind`,
`source`, `name`, `reason`.

Per-build: after every successful initial build and successful reload, a
single summary line is emitted:

```
metadata loaded with inconsistencies  count=N
```

Programmatic access: `(*controller.Controller).Inconsistencies()` returns a
snapshot of the current build's recorded entries. A `/v1/metadata/...` HTTP
surface is planned and will hand back the same data.

## Source-type matrix

The table below summarizes which inconsistency kinds each source type can
produce.

| Kind | PostgreSQL | SQLite | Remote schema |
|---|---|---|---|
| `database` | ✅ | ✅ | — |
| `remote_schema` | — | — | ✅ |
| `table` | ✅ | ✅ | — |
| `column` | ✅ | ✅ | — |
| `function` | ✅ | — | — |
| `computed_field` | ✅ | — | — |
| `select_permission` / `insert_permission` / `update_permission` / `delete_permission` (computed references or invalid PostgreSQL `_exists`) | ✅ | — | — |
| `relationship` | ✅ | ✅ | — |
| `enum_values` | ✅ | ✅ | — |
| `role` | ✅ | ✅ | ✅ |
