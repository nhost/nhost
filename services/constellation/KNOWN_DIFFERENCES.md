# Aggregates on non-aggregatable types

1. Aggregation, increments and ordering support for the type is discovered rather than hardcoded, this means:
   - types where the above is not supported in hasura but where the type actually supports it (e.g. vector) will now work as expected
   - min/max support is detected from explicit aggregate functions and from types with default btree operator classes (which support min/max via polymorphic aggregates like `min(anynonarray)`)
   - Hasura hardcodes which types support min/max and excludes types like bool, jsonb, and bytea even though PostgreSQL supports them. Constellation discovers support dynamically, so these types may appear in `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types when the database reports aggregate support for them.

2. Array-typed columns (e.g. `[String!]`, `[uuid!]`) are excluded from `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types.

3. If all columns of a table are non-aggregatable (e.g. only jsonb columns), the `max`/`min` fields are omitted from the `_aggregate_fields` type entirely rather than exposing empty types.

# Mutations with no update permissions

Update mutations are not generated for tables where the role has no update column permissions (i.e. the `_update_column` enum only contains `_PLACEHOLDER`). Hasura generates these mutations but they cannot actually update any columns, making them no-ops.

# Update mutations with no operators

Every update operator (`_set`, `_inc`, `_append`, `_prepend`, `_delete_key`,
`_delete_elem`, `_delete_at_path`) is nullable in the generated schema, so an
update mutation that supplies only `where`/`pk_columns` and no operator is valid
GraphQL. Constellation rejects such a request up front with a `validation-failed`
GraphQL error (`"at least one update operator must be provided"`, path
`$.selectionSet.<field>.args`), before any SQL runs. This applies to
`update_<table>`, `update_<table>_by_pk`, and every element of
`update_<table>_many`. (A preset-only update, where the role's update presets
supply the columns, is not empty and still succeeds.)

Hasura handles the same input inconsistently:

- `update_<table>` returns `{ "affected_rows": 0, "returning": [] }` (a silent no-op).
- `update_<table>_by_pk` returns an empty object `{}`, regardless of the selected fields.
- `update_<table>_many` returns `[]` for a single empty element, but raises a
  Postgres `syntax error at or near "WHERE"` when an empty element is combined
  with a non-empty one (it emits a malformed `UPDATE ... SET  WHERE ...`).

A single explicit validation error is more consistent than Hasura's mix of silent
no-op, empty object, and leaked SQL syntax error, so Constellation does not
reproduce those behaviors. This is the one deliberate divergence: Constellation
rejects where Hasura no-ops.

Requesting the **same column in more than one operator** (e.g. `_set` and `_inc`
on the same column) is rejected by both engines, and Constellation matches
Hasura's envelope byte-for-byte: message `Column found in multiple operators:
['<col>'].` with `extensions.code = "validation-failed"` and `extensions.path =
"$.selectionSet.<field>.args"`.

# Relationships in delete `returning`

A delete mutation's `returning` selection may include relationships. Constellation
resolves them within the same SQL statement that performs the delete, against the
deleted rows captured by `DELETE ... RETURNING *`. PostgreSQL evaluates a single
statement against one MVCC snapshot taken at statement start, so a relationship
sub-select sees the related rows as they were *before* the statement's own
effects — including rows removed by an `ON DELETE CASCADE` that the same delete
triggers.

In practice:

- **Object relationships** (e.g. deleting a `user_departments` row and selecting
  its `department`/`user`) point at rows that are not deleted, so they resolve to
  the correct single object — matching Hasura. This is the common case.
- **Relationships whose rows the delete itself removes** (e.g. deleting a
  `department` and selecting its cascade-deleted `employees`) resolve to those
  about-to-be-removed rows in Constellation, whereas Hasura evaluates the
  relationship against the post-delete state and returns `[]`.

So `delete_departments(...) { returning { employees { ... } } }` returns the
employees cascade-deleted along with the department in Constellation, and `[]` in
Hasura. Matching Hasura would require resolving delete `returning` relationships
in a second step after the DELETE statement completes, potentially within the
same transaction; Constellation keeps the single statement and returns the rows
it captured.

# Bulk metadata ops (bulk / bulk_keep_going / bulk_atomic)

All three bulk wrappers run their children against a single in-flight metadata
copy and perform exactly ONE durable write with ONE `resource_version` bump for
the whole request — matching Hasura, which writes the metadata once at the end
of a `/v1/metadata` request regardless of how many children it carries.

- `bulk` is fail-fast: the first child error aborts the whole request with no
  write (nothing the earlier children did is persisted). Children accept the
  full native op set — mutations, the read ops (`pg_get_viewdef`,
  `pg_suggest_relationships`), and the whole-metadata ops (`replace_metadata`,
  `clear_metadata`, `reload_metadata`) — exactly as the single-op path does. A
  read child sees tables/relationships created by earlier children in the same
  batch. `reload_metadata` as a child is a success no-op (the in-flight copy is
  already the current state). The success body is a bare top-level JSON array of
  per-child results, and per-child entries carry no `resource_version` (matching
  Hasura). A child may itself be a `bulk` / `bulk_keep_going` (which recurses and
  contributes a nested array) or a `bulk_atomic` (an all-or-nothing sub-group
  contributing a single `{"message":"success"}` object); the whole nested tree
  runs against the one working copy under the single write, and an abort deep in
  the tree reports the full path (`$.args[i].args[j]`).
- `bulk_keep_going` is the same but per-child: a failing child rolls back only
  itself and is reported as `{code, error}` in its slot; the surviving children
  are persisted by the single write.
- `bulk_atomic` composes its children into one schema-cache build (all-or-nothing
  rollback) and returns a single `{"message":"success"}` object. Per Hasura, it
  accepts only a narrow whitelist — `pg_create_object_relationship`,
  `pg_create_array_relationship`, `pg_drop_relationship`,
  `pg_delete_remote_relationship` (Hasura additionally allows native-query /
  logical-model / stored-procedure track-untrack, which Constellation has no ops
  for). Every other command (table tracking, permissions, functions, event
  triggers, reads, whole-metadata) is rejected by both engines.

One small, deliberate deviation remains:

- An unsupported `bulk_atomic` child is rejected by Hasura as an internal 500
  ("Bulk atomic does not support this command"); Constellation surfaces it
  through its op-level **400 `not-supported`** channel (500 is reserved for
  internal failures). This applies equally to a `bulk_atomic` nested inside a
  `bulk` (`bulk_atomic`'s whitelist excludes nested bulk, matching Hasura) and
  to a top-level one.

Nested bulk is bounded by a defensive depth cap (Hasura imposes none); the
dashboard never nests, so any real request is depth 1.

# Functions

Functions can return either SETOF <table> (0-many rows) or just <table> (exactly one row). Hasura allows filtering, ordering and limitting on functions that return <table>, which feels wrong since the function is only supposed to return one row. Hence, constellation does not expose where, limit, order_by, etc for functions that return a single row.

For the same reason, constellation does not generate the `_aggregate` root field for functions that return a single row. Aggregating over exactly one row has no meaningful use, so the field is omitted in query and subscription roots. Hasura emits it uniformly for any table-returning function.

Function arguments without a default value are exposed as non-null (`uuid!`) in `_args` input types. Hasura always makes them nullable (`uuid`) regardless of whether they have a default. Neither behavior is wrong since PostgreSQL will reject a missing required argument at execution time either way.

## Permissions

Constellation does not infer permissions for functions (HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS=false and not configurable) and need to be set explicitly. Otherwise, permissions work the same way as in hasura:

1. User needs select permissions on the return type of the function in addition to the permissions on the function itself.
2. Column permissions on the return type are applied to the result of the function.
3. Row level permissions on the return type are applied to the result of the function.
4. No permissions are applied on the input or on what the function does internally but the session can be passed and leveraged inside the function for permission checks. For instance:

```sql
CREATE OR REPLACE FUNCTION public.set_department_manager(p_user_id UUID, p_department_id UUID, session json)
RETURNS public.user_departments
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  result public.user_departments;
BEGIN
  IF session->>'x-hasura-role' != 'admin'
     AND NOT (p_department_id = ANY(COALESCE(session->>'x-hasura-department-manager', '{}')::uuid[])) THEN
    RAISE EXCEPTION 'Permission denied: not a manager of department %', p_department_id;
  END IF;

  -- Remove existing manager(s) for this department
  UPDATE public.user_departments
  SET role = 'member'
  WHERE department_id = p_department_id
    AND role = 'manager';

  -- Set the new manager and return the result
  INSERT INTO public.user_departments (user_id, department_id, role)
  VALUES (p_user_id, p_department_id, 'manager')
  ON CONFLICT (user_id, department_id)
  DO UPDATE SET role = 'manager'
  RETURNING * INTO result;

  RETURN result;
END;
$$;
```

# pg_untrack_table cascade scope

`pg_untrack_table` with `cascade=true` reproduces Hasura's transitive cascade:
beyond the table and its own dependents, it drops every metadata object that
depends on the table — object/array/remote relationships that point at it
(including bare `foreign_key_constraint_on` relationships and cross-source
`to_source` remote relationships), functions whose return type is the table, and
permissions whose row filter references it (directly via `_exists` or through a
relationship path that lands on it). Resolving bare foreign-key relationships and
function return types requires introspecting the source's data database; the
single-op handler opens a short-lived connection (from the source's
`connection_info.database_url`) to do so.

When that introspection is unavailable, the cascade degrades to a **metadata-only**
sweep — explicit-target relationships (`manual_configuration` /
`foreign_key_constraint_on` with a target table), cross-source remote
relationships, and permissions referencing the table directly via `_exists` are
still dropped, but bare foreign-key relationships and function drops are left in
the exported metadata and instead discarded from the live schema at reconcile as
inconsistencies. The metadata-only path applies in two cases:

- the source has no resolvable data URL (file-source deployments, or a
  `from_env` connection URL whose variable is unset);
- the data database is unreachable when the op runs.

`pg_untrack_table` inside a non-atomic `bulk` / `bulk_keep_going` now gets the
SAME full DB-backed cascade as the single-op path: the bulk engine resolves each
untrack child's cascade dependencies (FK graph, function return types) up front,
before taking the write lock, so bulk children are no longer limited to the
metadata-only sweep. (`bulk_atomic` does not accept `pg_untrack_table` at all —
see the bulk section above.)

Only function **return-type** dependencies are cascaded (matching how Hasura
tracks function output types); a function is never dropped for referencing the
table only in its body or argument types.

## pg_untrack_table without cascade

`pg_untrack_table` without `cascade` refuses with `dependency-error` whenever the
table has any dependent — both its OWN permissions/relationships and any REVERSE
dependent elsewhere in the metadata: a relationship in another table that points
at it, a function whose return type is it, or a permission on another table whose
row filter reaches it (directly via `_exists` or through a relationship path).
This matches Hasura, which fails an uncascaded untrack whenever its dependency
graph shows any dependent.

Reverse dependents that only the database knows — bare `foreign_key_constraint_on`
relationships and function return types — are resolved with the same short-lived
introspection the cascade path uses. When that introspection is unavailable (no
resolvable data URL, or the data database is unreachable) the gate degrades to
**metadata-only**: explicit-target relationships, cross-source `to_source` remote
relationships, and `_exists`/relationship-path permissions still block the untrack,
but bare foreign-key reverse relationships and function-return dependents do not.
In that degraded case an uncascaded untrack of such a table succeeds — and the
dangling reference is discarded from the live schema at reconcile as an
inconsistency — where Hasura would return `dependency-error`.


# Idempotent re-apply of create / track ops (200 vs Hasura 400)

Constellation treats re-applying a create/track metadata op with the SAME
definition as an idempotent success: it returns **200** with the body
`{"message":"<code>"}` (e.g. `already-tracked`, `already-exists`) and does not
bump `resource_version`. Hasura rejects the same re-apply with **400** and that
code. The affected ops:

- `pg_track_table` / `pg_track_function` re-track → 200 `already-tracked`.
- `pg_create_{object,array}_relationship` with a byte-identical definition →
  200 `already-exists` (a CHANGED definition for the same name is still rejected
  400 `already-exists`).
- `pg_create_{select,insert,update,delete}_permission` with a semantically
  identical definition → 200 `already-exists` (a changed definition → 400).
- `pg_create_function_permission` for an existing role → 200 `already-exists`.
- `pg_create_event_trigger` with the same name and no `replace` → 200
  `already-exists`.
- `pg_create_remote_relationship` with the same name → 200 `already-exists`.
- `pg_rename_relationship` to the relationship's current name → 200
  `already-exists`.

The error CODE is identical to Hasura's; only the status (200 vs 400) and the
idempotent no-write differ. Dashboards that re-save unchanged definitions see a
success instead of an error. `pg_untrack_table` re-untrack keeps Hasura's
behavior exactly: **400 `already-untracked`**.

Pinned by the offline parity harness (`controller/metadata_parity_replay_internal_test.go`,
case files under `controller/testdata/hasura/`); each diverging step carries a
`divergence:` note. See `controller/testdata/hasura/PORTING_MAP.md` for the full
Hasura-test → Constellation mapping.

# Error codes match; some error MESSAGES differ

The Hasura error `code` is reproduced for every metadata op (see
`classifyMutationError`), but the human-readable `error` string is not always
byte-identical. Notably:

- `dependency-error` from an uncascaded `pg_untrack_table`: Hasura names the
  specific dependent (e.g. `cannot drop due to the following dependent objects:
  relationship article.author in source "default"`); Constellation returns a
  generic message (`table has dependent permissions or relationships; pass
  cascade=true to drop them`). Same code, same status.

The offline parity cases assert the `code` (and, for bulk fail-fast, the error
`path`) but deliberately do not pin these messages.

# Not-yet-implemented validations (follow-ups, not intended divergences)

These are gaps surfaced while porting Hasura's metadata tests. The corresponding
parity steps are **skipped** (not relaxed to assert the wrong behavior); each is a
candidate fix rather than an accepted difference.

- **function/table cross-kind name collision.** Hasura rejects tracking a table
  whose root-field name collides with an already-tracked function (and vice
  versa) with `not-supported` (`function with name "X" already exists` /
  `table with name "X" already exists`). Constellation's `pg_track_table` /
  `pg_track_function` do not perform this cross-kind check, so the second track
  currently succeeds. (`controller/testdata/hasura/track_table/function_table_same_name_collision.yaml`)
- **implicit admin permission.** Hasura treats `admin` as having implicit full
  permissions, so an explicit `pg_create_select_permission` for `role: admin`
  fails with `already-exists`. Constellation does not model an implicit admin
  permission, so the first explicit admin permission create succeeds.
  (`controller/testdata/hasura/permissions/admin_role_divergence.yaml`)

# Op-time validation is deferred (FK existence, enum shape, column existence)

Constellation's `/v1/metadata` create/alter ops are pure metadata transforms:
they validate argument SHAPE (required fields, source/table tracked) but do not
introspect the data database at op time. Structural validity against the live
schema is enforced later, when the GraphQL schema is built / reconciled, where an
invalid object surfaces as an inconsistency. Hasura, by contrast, validates many
of these synchronously and rejects the op with `invalid-configuration`.

Cases where Constellation ACCEPTS (200) an op that Hasura REJECTS (400
`invalid-configuration`):

- `pg_create_object_relationship` / `pg_create_array_relationship` with a
  `foreign_key_constraint_on` column that has no matching foreign-key constraint
  (`no foreign constraint exists on the given column(s)`).
- `pg_set_table_is_enum: true` on a table that is not enum-shaped (Hasura
  requires a single text primary key and an optional comment column).
- A custom field name / relationship name that collides with another node only
  detectable by a whole-schema rebuild (`set_table_customization` conflicts).

These are NOT exercised as passing cases in the live two-engine parity harness
(`integration/metadata_parity_*_test.go`): the harness header lists them as
intentionally uncovered because Constellation's deferred-validation model makes
them diverge. They appear as LIVE entries in
`controller/testdata/hasura/PORTING_MAP.md`; validating the exact
deferred-inconsistency behavior requires the live env (`make parity-env-up`) plus
an enum-shaped-table fixture.
