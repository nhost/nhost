# PostgreSQL migrations for services

`pgmigrate` moves a service's PostgreSQL schema to the migration version shipped with the running build. If the build has newer migrations, it runs the `up` files. If the database is newer than the build, it runs the `down` files.

It saves both files for every migration in the database. That means an older build can undo migrations from a newer build even though it doesn't have those files. **Both builds must use `pgmigrate`** for this to work.

## Get started

Create the service schema before starting the service. `pgmigrate` creates its own tables inside the schema, but it does not create the schema itself. For example, during database setup:

```sql
CREATE SCHEMA IF NOT EXISTS service_schema;
```

The database user that runs migrations needs `USAGE` and `CREATE` on that schema. If that user didn't create the schema, grant those permissions during setup; see [Database permissions](#database-permissions).

Put paired SQL files in a directory next to your Go code, such as `postgres/1_create_table.up.sql` and `postgres/1_create_table.down.sql`. Then call `Migrate` when the service starts:

```go
package migrations

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log/slog"

	_ "github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

//go:embed postgres/*.sql
var embeddedMigrations embed.FS

func Apply(ctx context.Context, dsn string, logger *slog.Logger) (err error) {
	database, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("opening migration database: %w", err)
	}
	defer func() {
		if closeErr := database.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing migration database: %w", closeErr))
		}
	}()

	database.SetMaxOpenConns(2) // Enough for one caller of Migrate.
	if err := pgmigrate.Migrate(
		ctx, logger, database, embeddedMigrations, "postgres", "service_schema",
	); err != nil {
		return fmt.Errorf("migrating service schema: %w", err)
	}
	return nil
}
```

Here `"postgres"` is the directory inside `embeddedMigrations`; `"service_schema"` is the PostgreSQL schema name. There is no separate "latest version" setting: the highest version in the SQL files is the target.

The `schema` argument scopes the migration state and catalog tables and the advisory lock; it does not change the connection’s `search_path`. Schema-qualify every application object created or referenced in up and down SQL, or unqualified names will follow the connection’s configured search path instead of the supplied schema.

Use a **separate database pool** for migrations, not the pool your service uses for normal queries. `Migrate` needs two connections at once: one runs SQL, and the other reads saved migrations. Allow at least two connections per call (`SetMaxOpenConns(2)` is enough for one call at a time). Close the pool after `Migrate` returns, as the example does. Before releasing its connections, `Migrate` tries to reset the one that ran SQL. If the pool allows only one connection, it fails within five seconds instead of waiting forever.

## What happens when it runs

On a successful run, the steps look like this:

```text
        This build's .up/.down files
                     |
          Check files; find target
                     |
           Lock schema migrations
                     |
   Create/reuse tables; read current version
            (stop if dirty)
                     |
        Save SQL in the catalog table
                     |
     Check the path before running any SQL
                     |
       Database version vs. target?
           /         |         \
        lower       equal      higher
          |           |           |
    Run saved     No SQL     Run saved
      up SQL                  down SQL
          \           |           /
           +----------+----------+
                     |
      Archive catalog rows above target
                     |
        Unlock; release connections
```

If a step fails, `pgmigrate` stops and attempts to release its connections. A failure during or after SQL may still leave changes behind; see [Failures and timeouts](#failures-and-timeouts).

1. `pgmigrate` checks the embedded files. Each version needs matching `up` and `down` files with the same name after the version number. Empty files, comment-only files, and unrelated files in that directory are rejected.
2. It takes a database lock (the same one `golang-migrate` uses) so another call cannot migrate this schema at the same time. It creates or reuses `<schema>.schema_migrations` (the current version) and `<schema>.schema_migration_catalog` (the saved SQL). It checks that the current version isn't marked dirty, then saves the embedded SQL. If the database already has migration state but no catalog, it fills in the missing entries **without running that SQL again**.
3. It checks that it can read every migration needed to reach the target before running the first one. It then runs migrations from the catalog: `up` SQL saved from this build or `down` SQL that may have been saved by a newer build. The underlying driver records each step's destination version as dirty before running its SQL, then marks it clean on success. For a down step, that version is the predecessor of the migration being undone; see [Failures and timeouts](#failures-and-timeouts).
4. After a downgrade, it marks catalog entries above the new version as archived. It keeps their SQL and history instead of deleting them, so those version numbers can be reused by a later release.

The catalog keeps the exact SQL, a SHA-256 checksum for each file, each migration's name, and which migration came before it. `pgmigrate` checks a saved file's checksum before running it. This catches damage or unexpected changes, but not an attacker who can edit both the SQL and its checksum. Only the migration user should be able to write to these tables.

## Writing and changing migrations

Name files using the `golang-migrate` format, for example `2_add_name.up.sql` and `2_add_name.down.sql`. Both files must contain SQL, not just whitespace or comments. Keep other files out of the migration directory. Down migrations should undo the corresponding change where possible, but they can still lose data: back up important data and plan schema changes so old and new service versions can coexist during a rollout.

**Don't edit a migration that has already run.** That includes its name, SQL, checksum, and place in the sequence. `pgmigrate` checks the build's files against the saved entries and rejects changes to applied migrations. It leaves matching entries alone. If files for migrations that have *not* run yet change, it archives the old entries and saves the replacements.

If you need to replace migrations that have already run, downgrade first with a build that still knows the old sequence. For example, to replace `1 → 2-beta → 3-beta` with `1 → 2-stable`, first run a build targeting version `1` to execute the beta `down` files. Only then deploy the build containing `2-stable`. One call cannot both downgrade past a changed migration and replace it.

If even version `1` changed, the builds have no migration in common. `pgmigrate` cannot make that change on the existing schema. Keep using a compatible build, or back up the database, create a fresh schema or database, and move the application data yourself. For a disposable schema, you can drop and recreate it during maintenance. Don't edit migration tables by hand to pretend the builds share a migration.

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

## Rolling out and rolling back

Let only **one release** run migrations at a time. If old and new builds migrate the same database concurrently, they can keep moving it between their different target versions. Finish the schema change before sending mixed-version application traffic to that database.

An older build can roll back migrations from a newer build only if it calls `pgmigrate.Migrate`. Builds from before the switch to `pgmigrate` cannot read the saved `down` SQL and will fail against a version above their bundled migrations. To roll back to one of those builds, first run a `pgmigrate` build that targets a version the older build knows. The first release of a service using `pgmigrate` should add **no new migrations**, so it can serve as that intermediate build.

## Database permissions

The database user that calls `Migrate` needs:

- `CONNECT` on the database;
- `USAGE` and `CREATE` on the service schema (which must already exist);
- whatever permissions the migration SQL needs on existing tables, sequences, functions, extensions, or other schemas.

Let this user create the migration tables when possible. If another user created them, make the migration user their owner: the state table needs `SELECT`, `INSERT`, and `TRUNCATE`; the catalog needs `SELECT`, `INSERT`, and `UPDATE`; and setup needs to create or maintain catalog indexes. PostgreSQL normally allows ordinary users to take advisory locks, but grant access if your database has revoked it.

## Running tests

Service-owned, database-free tests can call `ValidateBundle` to apply the same bundle parser used by `Migrate` and assert the inferred target. Validate both the production embedded filesystem and its on-disk migration directory: an embed glob such as `postgres/*.sql` excludes stray files that the on-disk check must reject.

Without a PostgreSQL connection, `go test ./internal/lib/pgmigrate/...` runs unit tests and skips database tests. To run all tests, use a **disposable** database: the tests create and drop schemas and login roles. Provide a key/value DSN (not a URL) for a superuser, and allow the test-created roles to connect without passwords (for example, using `trust` on a local Unix socket):

```sh
PGMIGRATE_TEST_DSN='host=/path/to/socket dbname=postgres sslmode=disable' \
  go test ./internal/lib/pgmigrate/...
```

The Nix check starts a test server and sets the DSN automatically. It fails if the DSN is missing:

```sh
make -C internal/lib/pgmigrate check
```

The catalog's indexes are designed for PostgreSQL 13 and later; the Nix check currently runs PostgreSQL 18, not PostgreSQL 13. If starting PostgreSQL from Nix manually on macOS, use a Darwin `initdb` binary. For manual `psql` inspection, set `PGHOST` and `PGDATABASE`; `psql` does not read `PGMIGRATE_TEST_DSN`.

## If you change the catalog table

Old builds still need to read and write the catalog after a rollback. `CREATE TABLE IF NOT EXISTS` does not update an existing table, so add explicit, repeatable `ALTER` statements for schema changes. Keep existing columns and their types. Add only columns that allow `NULL` or have defaults, and don't add constraints that reject old inserts. Keep `format_version` at `1` for additions that old builds can ignore; old builds reject other format versions. A new format version needs a rollout that gives up rollback to builds that only understand version `1`.
