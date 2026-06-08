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
| Reconciling metadata against introspected source objects | No | Per-entity drops, recorded as `table` / `column` / `function` / `relationship` / `enum_values`. |
| Parsing optional action metadata sections | No | Malformed `actions.yaml`, `actions.graphql`, JSON `actions`, or JSON `custom_types` drops action/custom-type support and records `action` / `custom_type`. Required database and remote-schema metadata remains fatal as above. |
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

### `action`

Recorded when Hasura Action metadata is present but cannot be used by the
current build. Triggers:

* An optional action metadata file/section (`actions.yaml`, `actions.graphql`,
  or JSON `actions`) is malformed or incomplete.
* A handler URL or header/env reference is invalid or unresolved.
* The action references invalid input/output/custom types, transform documents,
  relationship metadata, or conflicting root/type names.
* An asynchronous action is configured but no action-log store is available, or
  the worker is enabled without explicit exclusive log-table ownership.

**Effect:** the action is omitted from the GraphQL schema and no webhook is
called. Valid sibling actions, databases, remote schemas, and unrelated metadata
continue serving.

### `custom_type`

Recorded when action custom-type metadata is present but cannot be used by the
current build. Triggers:

* The optional JSON `custom_types` section is malformed.
* The custom type is malformed, conflicts with another role-visible type, has
  invalid field/type references, contains a cycle, or declares an invalid action
  output relationship.

**Effect:** the custom type and affected actions are omitted from the action
schema surface. Valid sibling actions, databases, remote schemas, and unrelated
metadata continue serving.

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

> **What is *not* checked:** column references buried inside `filter` /
> `check` Hasura expressions are not walked, because doing so would require
> running the full where-parser at build time. A missing column inside a
> `filter` still produces a query-time error today, not an inconsistency.

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

## How inconsistencies surface today

Per-entry: each `Record` call emits a `WARN` log line with fields `kind`,
`source`, `name`, `reason`.

Per-build: after every successful initial build and successful reload, a
single summary line is emitted:

```
metadata loaded with inconsistencies  count=N
```

Programmatic access: `(*controller.Controller).Inconsistencies()` returns a
snapshot of the current build's recorded entries. The gated `/v1/metadata` API
currently covers action/custom-type writes plus minimal export/reload behavior;
it does not yet expose a Hasura-style inconsistencies endpoint.

## Source-type matrix

The table below summarizes which inconsistency kinds each source type can
produce.

| Kind | PostgreSQL | SQLite | Remote schema | Actions |
|---|---|---|---|---|
| `database` | ✅ | ✅ | — | — |
| `remote_schema` | — | — | ✅ | — |
| `action` | — | — | — | ✅ |
| `custom_type` | — | — | — | ✅ |
| `table` | ✅ | ✅ | — | — |
| `column` | ✅ | ✅ | — | — |
| `function` | ✅ | — | — | — |
| `relationship` | ✅ | ✅ | — | — |
| `enum_values` | ✅ | ✅ | — | — |
| `role` | ✅ | ✅ | ✅ | ✅ |
