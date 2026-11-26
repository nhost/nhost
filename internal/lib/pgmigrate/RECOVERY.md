# Recovering a failed migration

Use this guide when `Migrate` returns an error or the database is marked dirty. **Normal upgrades and rollbacks do not need manual SQL**: start the desired build, as shown in the [tutorial](TUTORIAL.md).

An error does not necessarily mean that nothing changed. Stop migration callers, inspect the database, and take a backup before repairing it. Never clear `dirty` just to make startup succeed.

## Failures and timeouts


Migration SQL and version updates are **not one all-or-nothing transaction**. The driver records the step's destination version as dirty, runs the SQL, then marks that version clean. If SQL fails, some changes may already have happened. `pgmigrate` tries to roll back any transaction left open on its connection, but that cannot undo changes already committed. It does not clear or repair a dirty migration for you.

For an upgrade to version `V`, dirty version `V` identifies `V`'s `up` step. For a downgrade from `V` to its predecessor `P`, dirty version `P` identifies **`V`'s `down` step**, not `P`'s. If that SQL was rolled back, `V`'s objects may still exist even though the state row says `P`.

Saving migration files in the catalog happens before running SQL. Archiving and connection cleanup happen afterward. So an error does **not** necessarily mean the schema stayed at its old version. Before retrying or repairing a failed migration, inspect `<schema>.schema_migrations`, `<schema>.schema_migration_catalog`, and the affected tables. For example:

```sql
SELECT version, dirty FROM service_schema.schema_migrations;
SELECT version, identifier, archived_at
FROM service_schema.schema_migration_catalog
ORDER BY version, registered_at;
```

For a failed downgrade, find the migration whose `down` step was attempted by following the active catalog's `previous_id` links. Versions need not be consecutive, and archived rows are history, not the current chain:

```sql
SELECT successor.version, successor.identifier
FROM service_schema.schema_migration_catalog AS successor
JOIN service_schema.schema_migration_catalog AS predecessor
  ON successor.previous_id = predecessor.id
JOIN service_schema.schema_migrations AS state
  ON state.version = predecessor.version
WHERE state.dirty
  AND predecessor.archived_at IS NULL
  AND successor.archived_at IS NULL;
```

Before manual recovery, stop all migration callers and back up the database. Compare the affected tables and other schema objects with the failed step's saved SQL. Finish or undo any partial changes, then set `schema_migrations` to the version that matches the actual schema with `dirty = false`. For example, if `V`'s failed down step left the schema at `V`, restore the state row to `V` before retrying; record `P` only once the reversal to `P` is complete. **Clearing dirty alone does not repair the schema.**

A new build cannot replace an applied migration's failing `down` SQL: applied catalog rows are immutable. Fix any data that makes the saved SQL fail before retrying from the matching clean version, or complete the reversal manually before recording the lower version.

Canceling the caller's context does not interrupt migration SQL once it starts. The context applies to most setup and catalog work, but it does **not** strictly bound the whole call: the upstream PostgreSQL driver checks or creates the state table and reads its version without using the caller's context. After SQL finishes, catalog archival and connection cleanup each use a separate five-second timeout for their database operations, even if the caller's context was canceled. Use PostgreSQL timeouts for the migration user if you need a bound on database operations.

## Recovering a dirty migration

Treat dirty-state recovery as a database repair, not as a state-table reset. Stop every instance that can call `Migrate` (or remove its migration-role access), prevent application writes that could conflict with the repair, and keep migration writers stopped until verification is complete. Use a maintenance window and take a restorable backup or snapshot before destructive or data-changing work; test the procedure on a restored copy when the migration can lose data.

The examples below are for an interactive `psql` session. Set `schema` to the exact service schema; `:"schema"` quotes it as an identifier and `:'schema'` quotes it as a value, so do not replace those forms with unquoted string concatenation.

```sql
\set schema 'service_schema'

SELECT version AS dirty_version, dirty AS state_is_dirty
FROM :"schema".schema_migrations
\gset recovery_

\echo Dirty version is :recovery_dirty_version; dirty is :recovery_state_is_dirty
```

Expect exactly one row and `recovery_state_is_dirty` to be `t`. If the table is empty, has multiple rows, or is not dirty, stop and investigate instead of using this procedure. The dirty version alone does not identify the direction when it is nonnegative; establish the attempted direction from the migration logs, the previous known-clean version, and the rollout target.

`golang-migrate` writes the target state with `dirty = true` *before* it executes a body. Its recorded-version semantics differ by direction:

- **Failed up:** dirty version `v` identifies the `v` row whose `up_sql` was attempted. The prior clean state is that row's `previous_version` (or no applied version when it is the root). Inspect the active row and both the attempted and compensating bodies:

  ```sql
  SELECT
    migration.id,
    migration.version,
    migration.previous_id,
    predecessor.version AS previous_version,
    migration.identifier,
    convert_from(migration.up_sql, 'UTF8') AS attempted_up_sql,
    encode(migration.up_sha256, 'hex') AS up_sha256,
    convert_from(migration.down_sql, 'UTF8') AS compensating_down_sql,
    encode(migration.down_sha256, 'hex') AS down_sha256,
    migration.format_version
  FROM :"schema".schema_migration_catalog AS migration
  LEFT JOIN :"schema".schema_migration_catalog AS predecessor
    ON predecessor.id = migration.previous_id
  WHERE migration.archived_at IS NULL
    AND migration.version = :'recovery_dirty_version'::bigint;
  ```

  Either safely finish the `up_sql` and verify state `v`, or reverse every effect already made by it and verify the predecessor state. Do not assume the whole body rolled back: inspect each DDL and data operation, including operations committed before the reported error.

- **Failed down:** dirty version `p` is the *target predecessor*, not the version of the down body. The attempted body is `down_sql` from the active successor row `v` whose predecessor is `p`. A dirty version of `-1` is the special case where the root migration's down body was attempting to reach the no-migration state.

  ```sql
  SELECT
    migration.id,
    migration.version AS down_migration_version,
    migration.previous_id,
    predecessor.version AS recorded_dirty_target,
    migration.identifier,
    convert_from(migration.down_sql, 'UTF8') AS attempted_down_sql,
    encode(migration.down_sha256, 'hex') AS down_sha256,
    convert_from(migration.up_sql, 'UTF8') AS compensating_up_sql,
    encode(migration.up_sha256, 'hex') AS up_sha256,
    migration.format_version
  FROM :"schema".schema_migration_catalog AS migration
  LEFT JOIN :"schema".schema_migration_catalog AS predecessor
    ON predecessor.id = migration.previous_id
  WHERE migration.archived_at IS NULL
    AND (
      (:'recovery_dirty_version'::bigint = -1 AND migration.previous_id IS NULL)
      OR predecessor.version = :'recovery_dirty_version'::bigint
    );
  ```

  Either safely finish that row's `down_sql` and verify predecessor state `p`, or restore every removed/changed object and datum and verify successor state `v`. For the root-to-`-1` case, a completed down means that no migration is applied. If either catalog query returns no row or more than one row, do not edit migration state; resolve the catalog or lineage inconsistency first.

Compare the selected SQL with the live database statement by statement. Check object definitions, columns, constraints, indexes, functions, ownership/privileges, and any data transformations or backfills relevant to that migration. For example, this gives a column inventory, but it is not a substitute for migration-specific integrity queries:

```sql
SELECT table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = :'schema'
ORDER BY table_name, ordinal_position;
```

Manually apply only the missing operations, or apply reviewed compensating operations to return to the other valid state. Use an explicit transaction when every operation permits it, and verify the resulting object definitions and application data before touching `schema_migrations`. Do not edit the catalog SQL, lineage, or checksums as part of recovery.

Only after the schema and data have been verified, set the state to the version they actually represent. Set `verified_version` to `v`, its numeric predecessor, or `-1` for no applied migration according to the outcome above—not merely to the release's intended target. Execute the following statements one at a time while migration writers remain stopped:

```sql
\set verified_version 42

BEGIN;
LOCK TABLE :"schema".schema_migrations IN ACCESS EXCLUSIVE MODE;
SELECT version, dirty FROM :"schema".schema_migrations;
-- Stop and ROLLBACK unless this still shows the dirty row inspected above.

TRUNCATE TABLE :"schema".schema_migrations;
INSERT INTO :"schema".schema_migrations (version, dirty)
SELECT :'verified_version'::bigint, false
WHERE :'verified_version'::bigint >= 0;

SELECT version, dirty FROM :"schema".schema_migrations;
-- COMMIT only if this exactly matches the verified database state.
COMMIT;
```

The empty table produced by `verified_version = -1` is the PostgreSQL driver's clean representation of "no migration applied"; otherwise there must be exactly one row with the verified version and `dirty = false`. **Never clear `dirty` blindly or choose a version only because it was the intended target.** Fix the cause of the original failure, then start one migration writer and observe its result before restoring normal rollout concurrency or application writes.

## Catalog compatibility

For maintainers changing the catalog table:


Old builds still need to read and write the catalog after a rollback. `CREATE TABLE IF NOT EXISTS` does not update an existing table, so add explicit, repeatable `ALTER` statements for schema changes. Keep existing columns and their types. Add only columns that allow `NULL` or have defaults, and don't add constraints that reject old inserts. Keep `format_version` at `1` for additions that old builds can ignore; old builds reject other format versions. A new format version needs a rollout that gives up rollback to builds that only understand version `1`.
