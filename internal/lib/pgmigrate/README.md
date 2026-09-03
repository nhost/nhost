# Database-backed PostgreSQL migrations

`pgmigrate` validates an embedded `golang-migrate` bundle, archives its exact SQL bytes in PostgreSQL, and moves a prepared service schema to the image's explicit target version. The catalog lets an older image run down migrations that were registered by a newer image even when those files are not embedded in the older image.

## Calling contract

```go
err := pgmigrate.Migrate(
    ctx,
    logger,
    database,
    embeddedMigrations,
    "postgres",
    "service_schema",
    latestVersion,
)
```

The caller must create the service schema before calling `Migrate` and must keep ownership of the supplied `*sql.DB`. The library acquires and closes two dedicated `*sql.Conn` values per concurrent `Migrate` caller: one executes migrations and holds the advisory lock, while the other reads catalog bodies. Size shared pools for two connections per concurrent caller, in addition to other pool users. Acquisition of the second connection is bounded and fails with pool guidance rather than hanging indefinitely when, for example, `MaxOpenConns(1)` is configured.

The target must equal the maximum version in the embedded bundle. Existing `<schema>.schema_migrations` state is reused. The bundle is published before state is read, so an existing clean schema already at the target is hydrated without replaying migration SQL. Dirty state is never forced or repaired; an operator must inspect the failed migration and recover it explicitly.

## Migration authoring and immutable catalog

Migration directories must contain only paired `*.up.sql` and `*.down.sql` files accepted by `golang-migrate`. Every pair must use the same version and identifier, and both bodies must contain executable, non-whitespace SQL. Do not leave unrelated files or comment-only placeholders in a migration directory.

`<schema>.schema_migration_catalog` stores each identifier, predecessor link, exact up/down bytes, SHA-256 checksums, and format version. Publication is additive and idempotent. After a version has been registered, never rename it, change its predecessor, edit either body, recalculate a different checksum, or reuse the version. A changed historical row or embedded file is an integrity failure.

Checksums detect corruption and release drift; they do not authenticate a database writer. A principal able to replace both a body and its checksum can make a later image execute arbitrary SQL. Restrict catalog and state-table writes to the migration role. Operators can inspect archived bodies without modifying them, for example:

```sql
SELECT
  version,
  previous_version,
  identifier,
  convert_from(up_sql, 'UTF8') AS up_sql,
  convert_from(down_sql, 'UTF8') AS down_sql,
  encode(up_sha256, 'hex') AS up_sha256,
  encode(down_sha256, 'hex') AS down_sha256,
  format_version,
  registered_at
FROM service_schema.schema_migration_catalog
ORDER BY version;
```

Catalog format 1 is a permanent old-image compatibility surface. Future compatible catalog columns must be nullable or defaulted, and readers and writers must continue naming columns explicitly. An incompatible body encoding or required-column change needs a separately coordinated format rollout and cannot preserve arbitrary old-image downgrade.

## Locking, permissions, and rollout

The wrapper serializes bootstrap, publication, preflight, and execution with the exact advisory-lock identity used by the upstream PostgreSQL driver: the current database, service schema, and `schema_migrations` table. It validates every linked body required for the requested direction before executing the first body. The upstream driver still controls per-migration dirty-state transitions.

A dedicated migration role needs:

- `CONNECT` on the database;
- `USAGE` and `CREATE` on the already-existing service schema, to create the state/catalog tables and migration objects;
- every object privilege required by the migration SQL for existing tables, sequences, functions, extensions, or other schemas.

The role that creates the state and catalog tables owns them. If an administrator pre-creates either table, transfer ownership to the migration role: the state driver needs `SELECT`, `INSERT`, and `TRUNCATE`, while catalog publication needs `SELECT` and `INSERT`, and bootstrap must be able to maintain the catalog index. PostgreSQL advisory-lock functions are executable by ordinary roles by default; deployments that revoke those functions must explicitly grant their use to the migration role.

Only one release target may act as migration writer during a rollout. Do not start N and N+1 migration writers concurrently against one database: each image targets its own maximum and can alternate the schema between versions. Complete the schema transition before mixed application traffic. Down scripts can destroy data even when they are syntactically valid; use backups and expand/contract migrations for data-preserving rollouts.

## Tests and PostgreSQL compatibility

A direct command runs all unit tests but skips the PostgreSQL integration suite unless a DSN is supplied:

```sh
PGMIGRATE_TEST_DSN='host=/path/to/socket dbname=postgres sslmode=disable' \
  go test ./internal/lib/pgmigrate/...
```

The Nix check starts PostgreSQL, sets `PGMIGRATE_TEST_DSN`, and sets `PGMIGRATE_TEST_DATABASE_REQUIRED=1`, which turns a missing DSN into a test failure:

```sh
make -C internal/lib/pgmigrate check
```

Catalog DDL deliberately uses a partial unique root index supported by PostgreSQL 13. The repository's Nix package no longer provides PostgreSQL 13, so the automated server run uses PostgreSQL 18 and serves as a structural PostgreSQL-14-and-later proxy while tests assert the PostgreSQL-13-compatible index definition.
