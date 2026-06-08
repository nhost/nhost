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

# Actions and action metadata API

Constellation implements Hasura Actions on the GraphQL request path, but a few
edges intentionally remain narrower than Hasura CE:

- The action Metadata API is disabled by default and only available when
  `--metadata-api-enabled` and `--metadata-api-sole-writer` are both set. Only
  action/custom-type operations plus minimal `bulk`, `export_metadata`, and
  `reload_metadata` are implemented; non-action metadata writes and
  `replace_metadata` remain out of scope.
- `drop_action.clear_data` removes the action metadata but does not yet purge
  asynchronous action-log rows.
- `export_metadata` returns Constellation's parsed metadata shape rather than
  Hasura's exact resource-version envelope.
- Asynchronous actions require an explicitly configured action-log store and
  exclusive worker ownership. Live Hasura-vs-Constellation async parity tests are
  gated until the comparison harness can isolate action-log tables for both
  engines.
