# PostgreSQL computed fields

Developer notes for table-owned computed fields. User-facing behavior is in
[`docs/user/postgres-features.md`](../user/postgres-features.md#computed-fields-on-tracked-tables),
[`docs/user/inconsistencies.md`](../user/inconsistencies.md) and
[`KNOWN_DIFFERENCES.md`](../../KNOWN_DIFFERENCES.md#computed-fields).

## Pipeline

1. **Metadata** (`metadata/`): definitions and select-permission grants are
   decoded per entry. A malformed entry keeps its raw value and decode error so
   reconciliation can report it. TOML export fails on invalid entries instead
   of dropping them.
2. **Introspection** (`connector/sql/postgres/introspect_computed_functions.go`):
   functions are resolved by catalog identity (bare names mean `public`, not
   `search_path`), including argument modes, defaults, row/session argument
   positions, return type and volatility.
3. **Reconciliation** (`connector/sql/reconcile_computed.go`): invalid
   definitions are dropped individually. Invalid grants and invalid or
   unexecutable computed references in filters/checks drop the whole
   permission. Collisions that would invalidate a role schema drop only the
   computed field.
4. **Schema and SQL** (`connector/sql/graphql/schema`,
   `connector/sql/graphql/queries`): the function receives the complete base row
   cast to its schema-qualified table type, never a role-projected or anonymous
   row, plus parameterized arguments. Table-valued fields reuse the collection
   builder over a correlated function source, with the returned table's
   permissions.
5. **Remote join keys** (`connector/composer`, `connector/relationships`): a
   computed LHS key is injected only when the SQL connector reports a
   reconciled non-`SETOF` scalar (`HasComputedJoinKey`), the role has an
   explicit grant, and every `to_source` target mapping is a role-selectable
   column (`HasSelectableJoinColumn`).

## Invariants

- Never serve a permission with a computed predicate stripped; drop the whole
  permission instead.
- Multiplexed subscriptions must keep `core.SessionVarValue` markers for
  session arguments, so each subscriber binds its own session.
- A successful `buildState` publishes reconciled schemas and SQL roots
  together. A polled `export_metadata` returns the raw snapshot and can be
  ahead of the served state.

## Tests

Lasting coverage is Constellation-only and runs without Hasura:

| Area | Tests |
|---|---|
| Metadata decoding, export and snapshots | `metadata/computed_fields_test.go`, `metadata/internal/hasura/computed_field_test.go`, `metadata/source/computed_*_test.go` |
| Introspection and reconciliation | `connector/sql/postgres/introspect_computed_functions*_test.go`, `connector/sql/reconcile_computed*_test.go`, `connector/sql/computed_reconciliation_test.go` |
| Schema, queries, aggregates, mutations, permissions and subscriptions | `connector/sql/graphql/{schema,queries}/computed*_test.go`, `connector/sql/computed_*_test.go` |
| Remote joins and customization | `controller/computed_join*_test.go`, `controller/computed_null_remote_schema_test.go`, `controller/computed_setof_join_key_test.go`, `connector/composer/computed_conflicts_internal_test.go` |
| Reload and export timing | `controller/computed_reload_internal_test.go`, `metadata/source/computed_snapshot_test.go` |

`integration/TestComputedFieldReference` is a small live comparison with the
pinned Hasura image, used as a sanity check during alpha; it is not the
regression suite. Fixtures live in `integration/computedfields/testdata/`.
