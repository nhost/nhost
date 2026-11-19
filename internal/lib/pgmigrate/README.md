# PostgreSQL migrations that follow your app version

`pgmigrate` is a Go library that moves a PostgreSQL schema to the migration version shipped with the running application. Starting a newer build upgrades the schema. Starting an older build rolls it back.

The key difference from file-only migration runners: **it saves both up and down SQL in PostgreSQL before running migrations**. An older build can therefore undo newer migrations it has never seen.

| Database version | Build's highest migration | What happens on startup |
| --- | --- | --- |
| 1 | 3 | Run the saved up SQL for versions 2 and 3 |
| 3 | 1 | Run the saved down SQL for versions 3 and 2 |
| 3 | 3 | Check the bundle and catalog; run no migration SQL |

Both builds must use `pgmigrate`, and their shared migration history must match. The older build still needs its own migration files; it does **not** need the newer files it is undoing. Rollback executes your down SQL—it is not a backup restore and cannot recover data that SQL discards.

**Start with the [hello-world tutorial](TUTORIAL.md)** to run the ready-made v1 and v2 apps, inspect their tables, and watch v1 roll back v2's migration using SQL saved in PostgreSQL.

## Add it to a service

`pgmigrate` lives under Nhost's `internal/` directory. These examples are for Go code inside the Nhost repository, not a separately installable Go module.

### 1. Create the service schema

Do this during database setup, before calling `Migrate`:

```sql
CREATE SCHEMA IF NOT EXISTS service_schema;
```

The library creates its migration tables inside this schema, but does not create the schema itself. The migration user needs `CONNECT` on the database, `USAGE` and `CREATE` on the schema, and the permissions required by your SQL. Let that user own the migration tables. See [database permissions](#database-permissions) if another user created them.

### 2. Add paired migration files

```text
migrations/
├── postgres/
│   ├── 1_create_messages.up.sql
│   ├── 1_create_messages.down.sql
│   ├── 2_add_language.up.sql
│   └── 2_add_language.down.sql
└── postgres.go
```

The highest version is the build's target; there is no separate target setting. Versions need not be consecutive. Every version needs matching up/down files with the same identifier, such as `2_add_language`.

**Schema-qualify application objects in your SQL**, for example `CREATE TABLE service_schema.messages (...)`. The `schema` argument scopes migration bookkeeping and locking; it does not change PostgreSQL's `search_path`.

### 3. Call `Migrate` at startup

Put this in `migrations/postgres.go`, beside the `postgres/` directory:

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

	database.SetMaxOpenConns(2)
	if err := pgmigrate.Migrate(
		ctx, logger, database, embeddedMigrations, "postgres", "service_schema",
	); err != nil {
		return fmt.Errorf("migrating service schema: %w", err)
	}
	return nil
}
```

Call `Apply` before starting the rest of the service, and stop startup if it returns an error. `"postgres"` is the directory inside the embedded filesystem; `"service_schema"` is the database schema.

Use a **dedicated, short-lived migration pool**, separate from the application's normal query pool. One `Migrate` call needs two connections at once, so allow at least two. The library closes its acquired connections, not the pool; `Apply` closes the pool above. A pool limited to one connection fails within five seconds rather than waiting forever for the second.

## What happens during startup?

```text
Check this build's files and infer its target
                    ↓
Lock migrations for this schema; stop if state is dirty
                    ↓
Save SQL in the catalog; check applied history still matches
                    ↓
Validate the entire path to the target
                    ↓
Run saved up SQL, saved down SQL, or neither
                    ↓
Archive catalog entries above the target; release connections
```

`golang-migrate` handles execution order and dirty state. The wrapper adds the database-backed catalog and validates the path before running the first migration body.

On first adoption, an existing `schema_migrations` table is reused. Missing catalog entries are populated from the bundle without replaying SQL that is already applied.

## Write and change migrations safely

- **Keep both directions executable.** Empty, whitespace-only, and comment-only bodies are rejected. Keep unrelated files out of the migration directory.
- **Do not edit applied migrations.** Their identifiers, exact SQL bytes, checksums, and predecessor links must remain unchanged. Add a new migration instead.
- **Write down SQL deliberately.** It should reverse the up SQL where possible. Review data loss and compatibility with older application code; the library does not prove that a down script is a safe reversal.
- **Downgrade before replacing an applied beta sequence.** To replace `1 → 2-beta → 3-beta` with `1 → 2-stable`, first run a compatible build targeting `1`. Only then deploy `2-stable`. One call cannot undo a changed applied history and replace it at the same time.

Matching catalog rows are reused. Retired or divergent **unapplied** entries are archived rather than deleted, allowing a replacement sequence to reuse their version numbers. If the builds have no migration in common, use a compatible build or plan a database/data migration; do not edit migration tables to pretend their histories match.

## Plan your rollout and rollback

- **Let only one release version run migrations at a time.** Same-version callers are serialized by the advisory lock. Old and new releases migrating concurrently can repeatedly move the schema between their different targets. Finish the migration phase before allowing mixed-version application traffic.
- **Make the first adoption release migration-neutral.** Builds from before `pgmigrate` cannot read saved down SQL. First adopt the library without adding new migrations, so that build can later act as an intermediate rollback target before returning to a pre-adoption build.
- **Back up important data.** Migration bodies and version updates are not one all-or-nothing transaction. A failure may leave partial changes; even a returned error can follow completed SQL.
- **Do not rely on the caller context as a whole-call timeout.** It covers most setup/catalog work, but upstream state-table setup and version reads ignore it, as does migration SQL execution. Use PostgreSQL timeouts such as `lock_timeout` and `statement_timeout` when needed. Post-execution archival and cleanup each have a separate five-second timeout.

If a migration fails, stop migration writers and inspect the actual schema before retrying. The library will not automatically repair dirty state. Follow the [recovery guide](RECOVERY.md); clearing `dirty` alone does not fix the database.

## Inspect the migration state

Replace `service_schema` with your schema:

```sql
SELECT version, dirty FROM service_schema.schema_migrations;

SELECT version, identifier, archived_at IS NOT NULL AS archived
FROM service_schema.schema_migration_catalog
ORDER BY version, registered_at;
```

- `schema_migrations` records the current version and whether a step is incomplete (`dirty`). An empty table means no migration is applied.
- `schema_migration_catalog` stores SQL, checksums, identifiers, links between migrations, and audit timestamps. Archived rows are retained history, not the active migration chain.

Checksums detect damaged or unexpectedly changed SQL. They do not protect against someone who can rewrite both the SQL and its checksum. Restrict write access to these tables to the migration user.

## Database permissions

The migration user needs `CONNECT` on the database, `USAGE` and `CREATE` on the existing service schema, and whatever privileges the migration SQL needs on application objects or extensions.

Let this user create the migration tables. If another user created them, make the migration user their owner: the state table needs `SELECT`, `INSERT`, and `TRUNCATE`; the catalog needs `SELECT`, `INSERT`, and `UPDATE`; setup also creates or maintains catalog indexes. PostgreSQL normally permits advisory locks, but grant access if your installation has revoked it.

## Validate bundles and run tests

Service tests can call `ValidateBundle(fsys, migrationPath)` without a database to check the same file rules used by `Migrate` and assert the inferred target. Check both the embedded filesystem and the on-disk directory: an embed glob such as `postgres/*.sql` hides stray files that the on-disk check should reject.

From the repository root:

```sh
# Unit tests; database tests are skipped without a test DSN.
go test ./internal/lib/pgmigrate/...

# Full package check, including a disposable PostgreSQL server and required DB tests.
make -C internal/lib/pgmigrate check
```

For direct database tests, set `PGMIGRATE_TEST_DSN` to a **key/value DSN**, not a URL, for a disposable database superuser. The tests create/drop schemas and login roles; those roles must be able to connect without passwords, for example through a trusted local Unix socket. `psql` does not read `PGMIGRATE_TEST_DSN`; use its own connection arguments or `PGHOST`/`PGDATABASE`.

The catalog supports PostgreSQL 13 and later; the Nix check uses PostgreSQL 18. If changing the catalog itself, preserve [compatibility with older builds](RECOVERY.md#catalog-compatibility).
