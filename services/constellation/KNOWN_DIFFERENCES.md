# Aggregates on non-aggregatable types

1. Aggregation, increments and ordering support for the type is discovered rather than hardcoded, this means:
   - types where the above is not supported in hasura but where the type actually supports it (e.g. vector) will now work as expected
   - min/max support is detected from explicit aggregate functions and from types with default btree operator classes (which support min/max via polymorphic aggregates like `min(anynonarray)`)
   - Hasura hardcodes which types support min/max and excludes types like bool, jsonb, and bytea even though PostgreSQL supports them. Constellation discovers support dynamically, so these types may appear in `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types when the database reports aggregate support for them.

2. Array-typed columns (e.g. `[String!]`, `[uuid!]`) are excluded from `_max_fields`, `_min_fields`, `_max_order_by`, and `_min_order_by` types.

3. If all columns of a table are non-aggregatable (e.g. only jsonb columns), the `max`/`min` fields are omitted from the `_aggregate_fields` type entirely rather than exposing empty types.

# PostgreSQL nested inserts and permission-check error presentation

Dependent PostgreSQL inserts now execute on one connection and one source
transaction: at each level, relationship-free inputs use one statement, while
inputs with any relationships run each row in input order. A row's before-parent
objects run first, followed by the row, then arrays and implicit remote-FK
`AfterParent` objects; arrays are depth-first per row. Siblings within each kind
follow Hasura v2.48.10-ce's metadata-name hash traversal: UTF-8 `Text` from
`text 2.1.1`, XXH3-64 seed zero from `hashable 1.4.7.0`, and low-to-high
five-bit fragments from `unordered-containers 0.2.20`. Constellation vendors
`github.com/zeebo/xxh3 v1.1.0`. A full 64-bit collision uses the relationship
name as a deterministic tie-breaker; Hasura can instead use map insertion order
for a full collision. The serialized version/order integration tripwire must be
rechecked when changing the Hasura image or its transitive Haskell libraries.
Explicit `manual_configuration.insertion_order: after_parent` for **object**
relationships remains unsupported (the key is dropped); the implicit
remote-table-FK ordering does not implement that manual key.

Parent and child physical `RETURNING` columns are captured as `::text`, with SQL
NULL preserved, then passed in bound parameters and cast to catalog-derived,
schema-qualified column types. Flat computed `returning` stays in its original
INSERT statement's snapshot; nested `returning` reads after the dependent
statements. Trigger-created rows are not included in `affected_rows`. Each dependent
node requires a separate PostgreSQL statement/round trip when its level has
relationships; deep or wide nested writes can have higher latency than a flat
insert. The entire chain remains atomic on one source transaction.

**Presentation-only exception approved by the operator:** a rejected insert or
update permission check (flat or nested insert, INSERT/DO UPDATE upsert, update,
update_by_pk or update_many) retains Constellation's existing SQLSTATE `ZZ901`
error message chain under the root operation wrapper, instead of Hasura's
`permission-error` code/path. Denial, transaction rollback and stored rows must
still agree. A zero-row parent with array or implicit after-parent descendants
also returns a Constellation-style error envelope rather than Hasura's
`not-supported` envelope; it must roll back prior writes. A before-parent
object whose own insert affects zero rows likewise fails and rolls back with
Constellation's envelope rather than Hasura's `not-supported` envelope. Explicit client input
for a parent-determined FK is a `validation-failed` error with Hasura's
message and nested GraphQL argument path (`object[0]` for `insert_one`,
`objects[i]` for collection inserts), **not** part of this presentation
exception. Role insert presets are separate from client input: a preset on a
relationship-determined FK wins over the relationship's captured value without
triggering determined-FK validation, as in Hasura. The role schema excludes
preset columns from client insert inputs; direct planner calls still distinguish
client columns from presets and reject explicit overlapping client FKs.
The 12 older integration fixtures with `expected:` overrides are
Constellation-only error contract tests: the integration harness skips its
Hasura request for those cases. Live denial parity is asserted separately by
serialized two-endpoint tests that reset and inspect persisted rows.

# Computed-field unknown filter keys (invalid metadata)

Computed-field definitions and grants identify which filter keys are computed
references. A permission filter referencing an unidentifiable key (no matching
definition or grant) retains Constellation's existing unknown-key behavior: the
**entire source** becomes unavailable. For a filter such as `missing_computed`
with no matching definition or grant, Nhost Hasura v2 instead reports only
that `select_permission` inconsistent and keeps the source. A filter with an
ordinary missing-column key causes the same source-wide failure in
Constellation. This intentional, documented difference applies only to invalid,
unidentifiable keys: it is **not** supported computed-field parity.
Identifiable computed permission predicates make only the affected permission
unavailable until those predicates can be executed.

# Computed-field support during alpha

PostgreSQL scalar computed fields support role-granted selection, argument-free
row `where`/`order_by`, and Hasura's aggregate outputs: eligible comparable
returns in `min`/`max` and numeric returns in the other eight operators, with
bound `args` and the declared return type. Unlike the dynamic **column**
aggregate support above, computed output eligibility follows Hasura's fixed
set: boolean and JSONB are excluded from `min`/`max`, while date,
timestamptz and uuid are included in SDL. In PostgreSQL installations without
`min(uuid)`/`max(uuid)`, selecting those fields fails with SQLSTATE `42883` in
both engines; advertised field availability is not a promise of a PostgreSQL
aggregate function. Hasura omits computed fields from aggregate-order inputs and argument-bearing
fields from row inputs. Identifiable computed permission predicates/checks remain unavailable;
table-valued selections and scalar fields with non-base argument types stay
hidden.

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
reproduce those behaviors. For empty update operators, Constellation
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

Functions can return either SETOF <table> (0-many rows) or just <table> (exactly one row). Hasura allows filtering, ordering and limiting on functions that return <table>, which feels wrong since the function is only supposed to return one row. Hence, constellation does not expose where, limit, order_by, etc for functions that return a single row.

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
