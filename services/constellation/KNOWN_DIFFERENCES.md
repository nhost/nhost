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
follow metadata-name hash traversal observed on Hasura v2.48.10-ce and
reverified by the serialized forward/reverse insert and rollback suite against
v2.50.3-ce. Its pinned dependencies are `text 2.1.3`, `hashable 1.5.1.0`
(which updates xxHash to 0.8.3), and `unordered-containers 0.2.21`.
Constellation hashes UTF-8 relationship names with seed-zero XXH3-64 and
compares five-bit fragments low-to-high, as verified by the live order suite;
this is version-coupled, not a guarantee for other Hasura images. Constellation vendors
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
Identifiable invalid or unsupported computed predicate references make only the
affected permission unavailable; executable argument-free PostgreSQL scalar
references are enforced. `_exists._table` accepts a bare table name or a map
with absent or null `schema`, resolving these forms against `public`, even when
the containing table is in another schema. An invalid `_exists` value, table
reference, `_where` map or untracked target revokes only its containing permission,
including computed-free predicates; this also corrects the pre-existing
source-wide failure for schema-less references. Ordinary unknown keys within a
valid `_where` outside a recognized computed-table predicate retain the source-wide
parser behavior. Non-computed
relationship-aggregate permission keys can still fail source construction.

# Computed function argument names (Hasura v2.50.3-ce)

Every exposed catalog or generated input name must be a valid GraphQL
identifier, not start with reserved `__`, and not duplicate another exposed
name (including an unnamed input's `arg_N`). Constellation rejects only the computed field at reconciliation, and
revokes a select permission explicitly granting that invalid field; other
fields, roles and unrelated roots remain available. Row and session inputs are
hidden and are not subject to this check.

Hasura accepts `__x` and a named `arg_1` alongside an unnamed input with the
same generated name; it exposes reserved or duplicate input fields, and one
supplied duplicate value binds to both function parameters. Constellation's
validated role schema cannot retain those fields without losing the entire
admin/granted role, so this is an intentional fail-closed selection difference.
Hasura rejects names such as `a$b`, quoted `my-arg`, and non-ASCII `ñame`
**atomically** at metadata validation, including with
`allow_inconsistent_metadata: true`. Constellation's field-local inconsistency
is narrower metadata acceptance, not exact Hasura rejection parity. This rule
is limited to computed fields; tracked root functions are unchanged.

# Computed remote-relationship join keys

Argument-free, non-SETOF PostgreSQL scalar computed fields can supply the LHS
key for `to_source` object/array and `to_remote_schema` relationships. Session
arguments are bound for each request. Text keys and JSONB-to-JSONB source
joins have positive results for objects, strings, arrays and numbers. JSONB
array `_aggregate` siblings bind and stitch typed JSON keys, keeping strings
distinct from numbers and correctly grouping objects and arrays. This also
fixes physical JSONB-key aggregate siblings (covered by a Constellation-only
regression); the computed siblings match a live Hasura v2.50.3-ce probe.
All JSON/JSONB computed keys are excluded from `to_remote_schema` relationships, regardless
of argument type: the live Hasura JSONB-object→`ID!` definition validates but
fails during execution. Argument-bearing, table-valued and scalar `SETOF`
computed keys are unavailable. Relationships keyed by these shapes are omitted
for every role (including admin), without an inconsistency. A restored Hasura
v2.50.3-ce scratch probe found that a `SETOF text` key's `to_source` object
relationship was exposed with consistent metadata **even without the computed
select grant**: one value joined its target, zero produced a null parent element,
and multiple values failed with `database query error`/`unexpected` at `$`.
Constellation deliberately keeps the SETOF relationship unavailable even for
admin and granted roles, rather than expose a multi-valued join key or let an
ungranted role join on a hidden computed value. This narrow security/correctness
difference is recorded in `integration/computedfields/testdata/phase14-oracle.json`;
it does not establish parity for other SETOF key shapes. Target row filters always apply; computed-key joins additionally
require each mapping target to name an actual role-selectable target column in GraphQL, not a relationship or computed field. Hasura v2.50.3-ce rejects remote
relationships in subscriptions; Constellation's WebSocket preflight rejects
them too. PostgreSQL `json` targets lack `json = json`, so ordinary and
grouped joins into them fail at execution, as in Hasura's equality join.

**Deliberate Hasura v2.50.3-ce authorization difference:** a role without the
computed field's explicit select grant does not see or use a relationship keyed
by it, even though Hasura may join internally using that denied key. The
relationship is absent from the role's SDL; no phantom join-key value reaches
the response. Admin has implicit access. This restriction applies only to
computed LHS keys; existing physical-column relationship rules are unchanged.

**Deliberate Hasura v2.50.3-ce authorization difference (target key):** for a
computed-key `to_source` join, a role unable to select every mapped target column
cannot see the relationship or its aggregate sibling in its SDL, even when it has the LHS computed
select grant and target row access. A serialized live Hasura probe granted
`item_label` and target `id` but denied target `label`: Hasura exposed and
positively joined `cf_label_object` and `cf_label_array` through `label`, while
direct `label` selection failed. That join is an equality oracle for a hidden
target value. Constellation intentionally prevents it: a relationship named
like a renamed, hidden column's physical SQL name does not count as a selectable
column, even if that relationship is visible or the role is admin. Target row filters
still apply separately. Physical-key relationships do not use this
computed-key target-column gate; JSONB-key binding also works when the target
column is role-hidden.

**Aggregate target name collisions:** Hasura interprets `field_mapping` target
names as physical SQL column names and may join through a hidden target column.
Constellation's computed-key target grant gate checks a role-selectable GraphQL
*column* against the target SQL connector's column enum, and its
ordinary/paginated arrays use GraphQL-first names. Aggregate siblings retain
SQL-name interpretation for unambiguous names (including physical names), but
reject a mapping if that name is both a GraphQL name and a different column's
SQL name. This fails the entire aggregate query without counts or nodes, even
for admin and physical-key aggregates, rather than allowing a hidden-value
oracle through the computed-key gate. GraphQL-only names of renamed target
columns still fail for aggregates; SQL-name mappings to renamed targets can
still fail on the ordinary array path. Neither failure grants extra access.

# SQLite remote-array pagination arguments

SQLite-target remote arrays apply `limit` (with optional `offset`) per parent
join key. Unlike SQLite root fields, remote arrays currently expose
`distinct_on`, but it fails at SQL execution. `offset` without `limit` also
fails at SQL execution on SQLite root and remote fields. These two failures
predate computed remote-join-key support; they are not supported pagination
forms.

# Remote relationships with null join keys

For every physical- or computed-key `to_source` relationship, a null parent
key (SQL NULL or JSONB literal null) produces an explicit `null` for object,
array and aggregate fields, including inside another remote result. Previously
Constellation omitted the field for all-null batches and returned `[]` for a
null-key array in a mixed batch. The new response deliberately matches Hasura
even though both engines declare array and aggregate fields `NON_NULL` in SDL.
A JSONB null key never matches target JSONB null. A non-null unmatched key
still produces object `null`, array `[]`, or an empty aggregate.

A null `to_remote_schema` LHS produces explicit `null` without a remote
request; a non-null computed team ID joins the real team without exposing a
phantom key. A serialized Hasura v2.50.3-ce oracle returned null for item 1
and the team for item 2 to both granted and ungranted roles. Constellation's
independent `controller/TestComputedNullRemoteSchemaKeyAndGrant` pins the
null/non-null results for a granted role and the Phase 13 approved stricter
behavior: an ungranted role cannot see or use the relationship. The selected
response never includes the internal key. This comparison does **not** waive
the grant requirement.

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
aggregate function. Hasura omits scalar computed fields from aggregate-order inputs and argument-bearing
fields from row inputs. Argument-free scalar permission filters/checks run against
the physical row and may use session arguments, relationships and `_exists`;
invalid references revoke only their permissions. PostgreSQL tracked-table
returns (both `SETOF` and single composite) inherit the target table's select
permissions (row and column), accept bound arguments and collection modifiers,
and work in shared row selections; an explicit computed-field grant for a table
return instead revokes the granting select permission. A single-table function
returning no SQL row or a NULL composite yields one all-null object in the
list for unrestricted target roles; target row filters may exclude that object.
Hasura does not expose an aggregate selection sibling on the field. `SETOF`
base-type returns are nullable scalar fields, including row boolean/order and
eligible aggregate output inputs. Direct multi-row selection fails with SQLSTATE
`21000`, predicates with `0A000`, while ordering can multiply parent rows;
`max` reduces returned rows; aggregate `count`, physical columns, computed operands and `nodes` share one expanded row source. A parent producing zero values disappears and a parent producing three appears three times; multiple selected SETOF functions expand in PostgreSQL target-list lockstep (not a Cartesian product). This also holds for nested and per-key windowed grouped aggregates. `avg` and variance operate on those flattened rows, not per-parent averages. Only independently classified `pg_catalog` scalar `SETOF` returns `text`, `numeric`, `int4`, `float8`, `bool`, `date`, `uuid`, `jsonb` and installed `public.citext` are enabled. Boolean/JSONB expose no min/max/sum/avg; date/citext expose min/max; numeric/int4/float8 also expose numeric aggregates. UUID min/max are advertised but fail at execution with 42883 on installations without those PostgreSQL aggregates, as on pinned Hasura. Vector, spatial, array and other untested BASE returns remain gated.
For the enabled scalar SETOF kinds, a zero-row direct scalar yields a null parent,
a multi-row direct scalar errors (`21000`), and even a zero/one-row user `where`
errors (`0A000`). Select filters, insert/update checks and update/delete filters
referencing these enabled scalar SETOF fields are retained but fail closed with
PostgreSQL `0A000` on execution; no attempted write persists. A restored Hasura
v2.50.3-ce scratch probe accepted separate select-filter, insert-check,
update-filter, update-check and delete-filter metadata, but each request failed
with `database query error`/`unexpected` and made no scratch-row write. These
outcomes match the denial/rollback behavior; Constellation retains its approved
production error sanitizer rather than Hasura's client envelope. Ordering drops
zero-cardinality parents and duplicates
multi-cardinality parents. In single-object mutation returning, zero gives a
null mutation field while the write persists; collection `returning` preserves
one null array element per zero-cardinality affected row and keeps
`affected_rows` accurate. Multi-row returning raises PostgreSQL `21000` and
rolls back the entire same-source mutation (including other affected rows).
A restored Hasura v2.50.3-ce scratch probe confirmed collection insert,
upsert DO UPDATE, update, update_many and delete `returning`: zero produces
`[null]` while persisting the successful operation, one produces an object,
and multiple values fail and roll back the entire scratch mutation (including
a mixed-cardinality insert). Hasura responds with `unexpected` and a database
query error; Constellation uses the inherited production database-error
sanitizer or the raw chain in dev mode, **not** necessarily `21000` in the
GraphQL response. Tracked-table
`SETOF` zero/one/many yields `[]`/one/many, whereas a missing single composite
returns a list containing an all-null row for unrestricted target roles.

**Approved scalar/object metadata collision (Hasura v2.50.3-ce):** A
PUBLIC computed-argument enum whose GraphQL scalar name equals a tracked
scratch table's object type caused `replace_metadata` to reject atomically
(HTTP 500 `unexpected`, path `$.args`) with and without the reader grant, even
with `allow_inconsistent_metadata: true`. Neither definition nor grant was
installed and existing roots/roles remained intact. Constellation instead
accepts the metadata but records a `computed_field` inconsistency and omits
only the colliding computed selection and orphan argument types; valid roots
and grants survive. This is a narrow, approved **metadata-acceptance** difference,
not a Hasura parity claim for other scalar/object, enum or input collisions.
The control computed field was submitted in the same rejected replacement and
its independent Hasura acceptance is unproven. Redacted evidence is under
`integration/computedfields/testdata/phase14-oracle.json`.

**Approved aggregate-sibling collision (Hasura v2.50.3-ce):** With a computed
field named exactly like an existing array relationship's `<rel>_aggregate`
sibling, Hasura reports consistent metadata but emits **two** fields of that
name in both the row SDL (object and scalar) and `order_by` (aggregate-order
object and `order_by` enum). Constellation instead records a `computed_field`
inconsistency and omits only the ambiguous computed selection and its grant;
the real array relationship and its aggregate sibling, unrelated roots and
select permissions remain available to authorized roles. This exception does
not change exact relationship/column collision handling or permission gates.

**Table-computed aggregate-order name collision (Hasura v2.50.3-ce):** For an
argument-free table field `X`, a column (including a custom name), object
relationship or argument-free scalar computed field named `X_aggregate`
collides with the generated order input. Hasura accepts the metadata and keeps
both roles and the `X` selection, but emits duplicate input fields; neither
meaning of `X_aggregate` is usable in `order_by`. Constellation instead marks
the table field inconsistent and removes its selection, EXISTS predicate and
aggregate order input. The genuine field, its working order input and unrelated
role roots remain. This conservative field-local omission avoids serving an
invalid schema or misrouting an object relationship's order input. An array
relationship named `X_aggregate` does not collide: its generated order key is
`X_aggregate_aggregate`. Argument-bearing table fields emit no aggregate order
input and are unaffected.

Argument-free table functions appear in row `bool_exp` as EXISTS and in
`order_by` through the target's aggregate-order input; these user inputs
respect returned-table select permissions, including row filters in patched
Hasura v2.50.3-ce. Role table predicates execute without a target select grant and revoke the
whole affected permission when invalid. Relationship-aggregate permission keys
are rejected by Hasura; identifiable computed references there remain unavailable.

**Approved narrow custom-argument runtime difference (Hasura v2.50.3-ce):**
Hasura accepts and exposes non-public schema-qualified domain (integer/text),
enum and composite computed arguments, including a domain argument to a
`SETOF` tracked-table function. Its string, null and variable-valued requests for these types
fail with `constraint-error`, path `$`, and `type "<type>" does not exist`;
its omitted enum default executes. A public-schema domain control instead
executes `n:"2"` (14.5) and `n:null` (null); `n:2` is `parse-failed`
with `A string is expected for type: <type>` at the input argument path,
`n:"0"` is a `permission-error` domain check and `n:"x"` a
`data-exception` integer-input failure (both at `$`).
Constellation exposes the same role-granted fields, custom scalar and `_args`
names (composite input `<type>_scalar`), and string-only parse rule, but uses
**bound, schema-qualified casts** so accepted non-public custom inputs can
execute and return data rather than reproducing the pinned type-not-found
failure. Invalid values still go through PostgreSQL validation; null/default
and target select permissions remain in force. A disposable public enum/enum-array Hasura control accepts bare `happy` and quoted `"happy"` for a scalar, rejects numeric with `parse-failed` at `$.selectionSet.<root>.selectionSet.<field>.args.args.m`, and reports `data-exception` at `$` for an invalid label. For the array, bare `happy` is a malformed-array `data-exception` at `$`, quoted `"{happy}"` succeeds, list `[happy]` and numeric are `parse-failed` at the argument path, invalid label is `data-exception` at `$`, and null/default execute in both shapes. Constellation uses the shared string-token parser plus qualified casts. Earlier nonpublic enum requests parsed both bare and quoted names but then failed with the pinned type-not-found error; that observation does not prove nonpublic Hasura execution parity. Built-in `int4range`, `int4multirange`,
`int[]` and user-enum-array string inputs execute with bound casts; non-string
inputs are rejected. Array **returns**, including `text[]`, are not BASE
returns: their definitions are inconsistent, and an explicit grant revokes only
the granting select permission. This exception does not permit new argument
kinds, unsupported return signatures, broader grants or changes to unrelated
errors. Selected serialized, redacted v2.50.3-ce observations are checked in at
`integration/computedfields/testdata/phase14-oracle.json`; independent
Constellation-only contracts are in `connector/sql/computed_{custom_arguments,return_signatures}_test.go`.

## Inherited database-error sanitization and strict Int inputs (approved Phase 14)

Constellation retains its pre-Phase-1 production database-error sanitizer:
computed public-domain check failures (SQLSTATE 23514), computed invalid
integer casts (22P02), and a physical `int4range` column's invalid literal
(22P02) return `errors: [{message: "internal server error (trace id: …)"}]`
without Hasura `extensions.code`/`path` or raw SQL, input, constraint, or
SQLSTATE details. Dev mode instead returns the raw `failed to execute
operations: … (SQLSTATE …)` chain, still without Hasura extensions. Hasura
v2.50.3-ce returns `permission-error` for domain 23514 and `data-exception`
for invalid cast 22P02, with PostgreSQL details and path `$`. This is an
**inherited security/presentation difference**, not an assertion of equal
error envelopes or a general waiver for other database errors. Successful
public-domain inputs and the fail/accept outcomes remain required. The
independent HTTP/controller test `controller/TestComputedArgumentHTTPInheritedErrorAndIntControls`
pins both modes and a physical-column control on isolated testdb; the earlier
column-only raw-chain precedent is `integration/misc_multi_database_test.go`.
The pinned engine's read-only column-only outcomes are summarized under
`inherited_column_controls` in the checked-in redacted
`integration/computedfields/testdata/phase14-oracle.json` (not claimed as exact
error envelopes).

Constellation also retains strict GraphQL `Int` input handling in both computed
arguments (`item_score.multiplier`) and physical-column predicates (`id._eq`).
A **quoted** Int (`"3"` computed, `"1"` column) is rejected with `Int cannot
represent non-integer value` and GraphQL `locations`, while Hasura v2.50.3-ce
**accepts and executes** those quoted strings in both paths. Floats (`2.5`)
are rejected with validation locations in Constellation versus Hasura's
`parse-failed` path; literals outside int4 (`2147483648`) reach pgx encoding
and are sanitized in production / returned as raw encode errors in dev mode,
while Hasura responds `parse-failed`. Valid unquoted Int values work in both.
This is an inherited **success-versus-rejection** difference for quoted Int,
not presentation-only and not permission to relax other scalar coercion. The
same independent HTTP test pins all three edges in both column and computed
paths. Neither sanitizer nor Int parser was changed for this phase.

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

When a tracked root function's `<function>_args` and a computed field's
`<field>_<table>_args` have different fields in the same source, Hasura
v2.50.3-ce rejects the metadata atomically (even with
`allow_inconsistent_metadata: true`). Constellation accepts the document but
omits only the computed selection and records a `computed_field` inconsistency;
the function and other roots remain available. When the PostgreSQL argument
names/types are identical, Hasura shares a nullable input and serves both
fields. Constellation's non-null tracked-function arguments still conflict with
the nullable computed input when no default exists: it omits the computed
selection rather than changing the tracked function's existing contract.
Inputs that are already identical in GraphQL (e.g. a defaulted function
argument) remain shared.

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
