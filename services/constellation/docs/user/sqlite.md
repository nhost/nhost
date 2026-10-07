# SQLite source differences

Constellation exposes SQLite databases through the same Hasura-compatible GraphQL
metadata model used for PostgreSQL sources where SQLite can support the same
semantics. Some PostgreSQL features have no SQLite equivalent; this page records
the customer-visible differences that follow from those limits.

SQLite-target cross-source array relationships apply `limit` (with optional
`offset`) per non-null parent join tuple, including composite mappings. The
target row filter and user predicates apply before each tuple's window. Multiple
tuples use bounded batched statements (chunked when necessary), not an unbounded
fetch and post-slice. `offset` without `limit` currently fails at SQL execution
on SQLite, including root queries. SQLite root fields do not expose `distinct_on`,
but SQLite-target **remote arrays do expose it** and currently fail at SQL
execution when it is used. Neither form is supported yet.

For cross-source relationships joining into SQLite `JSON`/`JSONB`-declared
columns, keys are matched against **stored JSON text**, not PostgreSQL-style
semantic JSON equality. Numbers and strings remain distinct (including `1`
versus `"1"`); SQL NULL and JSON `null` parent keys yield null relationships.
The stored key must have the same canonical spelling as the serialized parent
value: minified JSON with sorted object keys and Go JSON escapes for `<`, `>`
and `&`. A key stored with other whitespace, object-key order, HTML escaping
or numeric spelling may not match, even when it represents the same JSON value.
This applies to ordinary object and array joins as well as per-parent paginated
arrays. Use PostgreSQL JSONB join columns if semantic JSON equality is needed.

## SQLite write mutations are not executable yet

Tracked SQLite tables still advertise the full PostgreSQL **write** mutation
surface — `insert`, `insert_one`, nested inserts, `on_conflict` upserts,
`update`, `update_by_pk`, `update_many`, `delete`, and `delete_by_pk` — because
schema generation currently shares the PostgreSQL mutation surface and is not
gated by the SQLite dialect. **None of these generated write mutations execute
against SQLite yet.** Read operations (queries, aggregates, subscriptions,
relationships) are unaffected; only writes fail.

The reason is shared by every write path, not just inserts: each mutation builder
wraps the data-modifying statement in a CTE that returns the affected rows so the
final `SELECT` can shape the GraphQL response — for example
`WITH mutation_result AS (UPDATE ... RETURNING *) SELECT ...`. Data-modifying
statements inside a `WITH` clause are a PostgreSQL extension; SQLite (3.45) does
not support `INSERT` / `UPDATE` / `DELETE` inside a CTE and rejects the statement
at prepare time with a syntax error such as `near "UPDATE": syntax error`.
Nested insert steps instead fail explicitly with `dependent insert steps are
unsupported by SQLite` before any write. This is independent of the `RETURNING`
and `ON CONFLICT` limitations — even a plain
`update`/`delete` with no upsert and no post-mutation permission check fails for
the same reason.

The affected generated fields, all of which fail at runtime on SQLite, are:

| Generated mutation field | Builder | Failing shape |
|---|---|---|
| `insert_<table>`, `insert_<table>_one`, nested inserts | `root_mutation_insert_*.go`, `mutation_insert_steps.go` | Flat: writable CTE; nested: explicit unsupported-step error |
| `insert_<table>(... on_conflict: ...)` upserts | `mutation_insert_on_conflict.go` | `WITH ... AS (INSERT ... ON CONFLICT ... RETURNING *)` |
| `update_<table>` | `root_mutation_update_collection.go` | `WITH ... AS (UPDATE ... RETURNING *)` |
| `update_<table>_by_pk` | `root_mutation_update_by_pk.go` | `WITH ... AS (UPDATE ... RETURNING *)` |
| `update_<table>_many` | `root_mutation_update_many.go` | `WITH ... AS (UPDATE ... RETURNING *)` (per update) |
| `delete_<table>` | `root_mutation_delete_collection.go` | `WITH ... AS (DELETE ... RETURNING *)` |
| `delete_<table>_by_pk` | `root_mutation_delete_by_pk.go` | `WITH ... AS (DELETE ... RETURNING *)` |

As a consequence, the non-admin insert/upsert/update/delete permission behavior
documented for PostgreSQL is not available for SQLite sources. Treat every SQLite
write mutation as unsupported until the data-modifying-CTE shape is replaced with
a SQLite-compatible write pipeline; this matches the feature matrix in
[PostgreSQL features](postgres-features.md#feature-support-matrix).

Use PostgreSQL sources when clients need Hasura-compatible insert, upsert, update,
or delete mutations and permissions. If you keep a SQLite source, treat it as
read-only from the client's perspective and do not rely on any generated SQLite
write mutation field for client writes.
