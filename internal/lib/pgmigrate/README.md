# Database-backed PostgreSQL migrations

`pgmigrate` validates an embedded `golang-migrate` bundle, archives its exact SQL bytes in PostgreSQL, and moves a prepared service schema to the bundle's highest version. The catalog lets an older image run down migrations that were registered by a newer image even when those files are not embedded in the older image.

## Calling contract

```go
err := pgmigrate.Migrate(
    ctx,
    logger,
    database,
    embeddedMigrations,
    "postgres",
    "service_schema",
)
```

The caller must create the service schema before calling `Migrate` and must supply a dedicated, short-lived migration `*sql.DB` that remains caller-owned. Do not reuse a service's long-lived application pool; migration bodies may change session state, and sharing that pool is unsupported. The library resets the execution session before releasing it, but the caller must still close the migration pool after `Migrate` returns.

The `schema` argument scopes the package-owned `schema_migrations` and `schema_migration_catalog` tables and the advisory lock identity. It does not change `search_path`; PostgreSQL executes migration bodies with the migration connection's configured search path. Every application object created or referenced by an up or down body must therefore be schema-qualified.

The library acquires and closes two dedicated `*sql.Conn` values per concurrent `Migrate` caller: one executes migrations and holds the advisory lock, while the other reads catalog bodies. Configure the migration pool for at least two connections per concurrent caller. Acquisition of the second connection is bounded and fails with pool guidance rather than hanging indefinitely when, for example, `MaxOpenConns(1)` is configured.

The caller context bounds setup and preflight, but it is not a wall-clock bound for `Migrate`. Once migration SQL starts, caller cancellation or deadline expiry does not interrupt it. After execution, catalog archival ignores caller cancellation but has a five-second timeout, and connection cleanup has a separate five-second timeout. `Migrate` returns after those attempts and reports archival or cleanup failures. Configure PostgreSQL timeouts for the migration role when migration SQL itself needs an execution bound.

The target is inferred from the maximum version in the embedded bundle, so callers do not maintain a duplicate latest-version constant. Existing `<schema>.schema_migrations` state is reused. After catalog bootstrap, the library reads the clean migration state, reconciles the active catalog lineage with the embedded bundle, and hydrates missing rows without replaying migration SQL. Dirty state is never forced, reconciled, or repaired; an operator must inspect the failed migration and recover it explicitly.

## Migration authoring and catalog lineages

Migration directories must contain only paired `*.up.sql` and `*.down.sql` files accepted by `golang-migrate`. Every pair must use the same version and identifier, and both bodies must contain content beyond SQL comments and whitespace. Do not leave unrelated files or comment-only placeholders in a migration directory.

`<schema>.schema_migration_catalog` stores each migration under a random UUID, links it to its predecessor UUID, and preserves its identifier, exact up/down bytes, SHA-256 checksums, and format version. Partial unique indexes enforce one version, root, and successor in the active lineage. Archived rows remain in the same table with `archived_at` and `archive_batch_id`, so their UUID-linked historical lineage remains inspectable while their sequence numbers can be reused by the active lineage.

Rows through the currently applied version are immutable. Never rename an applied migration, change its predecessor, edit either body, or recalculate a different checksum. Unapplied active rows are also reused unchanged when they match the embedded bundle. When the embedded future differs, the library archives that inactive suffix before publishing the replacement. After a successful downgrade, it archives every row above the new target.

An active lineage can be replaced in place only after the schema has been downgraded below its lowest diverging version. A single `Migrate` call never crosses a divergence at or below the applied version. When the bundles share a common lineage version, first deploy an image whose bundle maximum is at or below the last common version, then deploy the replacement image. For example, replacing `1 -> 2-beta -> 3-beta` with `1 -> 2-stable` requires an image targeting `1` to execute the beta down migrations from `3` to `1`; only after that succeeds can the squashed stable image target `2`.

When the active and embedded bundles have no common lineage version, such as after a full-prefix squash that rewrites version `1`, `pgmigrate` cannot replace the lineage in place. Keep using an image compatible with the applied lineage, or plan an out-of-place transition: back up the database, initialize the replacement bundle in a fresh schema or database, and explicitly migrate the required application data. A disposable schema can instead be dropped and recreated during maintenance. Never manufacture a common version by editing catalog or migration-state rows.

Checksums detect corruption and release drift; they do not authenticate a database writer. A principal able to replace both a body and its checksum can make a later image execute arbitrary SQL. Restrict catalog and state-table writes to the migration role. Operators can inspect active and archived bodies without modifying them, for example:

```sql
SELECT
  migration.id,
  migration.version,
  predecessor.version AS previous_version,
  migration.identifier,
  convert_from(migration.up_sql, 'UTF8') AS up_sql,
  convert_from(migration.down_sql, 'UTF8') AS down_sql,
  encode(migration.up_sha256, 'hex') AS up_sha256,
  encode(migration.down_sha256, 'hex') AS down_sha256,
  migration.format_version,
  migration.registered_at,
  migration.archived_at,
  migration.archive_batch_id
FROM service_schema.schema_migration_catalog AS migration
LEFT JOIN service_schema.schema_migration_catalog AS predecessor
  ON predecessor.id = migration.previous_id
ORDER BY migration.version, migration.registered_at;
```

## Locking, permissions, and rollout

The wrapper serializes bootstrap, clean-state validation, catalog reconciliation, preflight, execution, and post-downgrade archival with the exact advisory-lock identity used by the upstream PostgreSQL driver: the current database, service schema, and `schema_migrations` table. It validates every linked body required for the requested direction before executing the first body. The upstream driver still controls per-migration dirty-state transitions.

A dedicated migration role needs:

- `CONNECT` on the database;
- `USAGE` and `CREATE` on the already-existing service schema, to create the state/catalog tables and migration objects;
- every object privilege required by the migration SQL for existing tables, sequences, functions, extensions, or other schemas.

The role that creates the state and catalog tables owns them. If an administrator pre-creates either table, transfer ownership to the migration role: the state driver needs `SELECT`, `INSERT`, and `TRUNCATE`, while catalog reconciliation needs `SELECT`, `INSERT`, and `UPDATE`, and bootstrap must be able to maintain the catalog indexes. PostgreSQL advisory-lock functions are executable by ordinary roles by default; deployments that revoke those functions must explicitly grant their use to the migration role.

Only one release target may act as migration writer during a rollout. Do not start N and N+1 migration writers concurrently against one database: each image targets its own maximum and can alternate the schema between versions. Complete the schema transition before mixed application traffic. A sequential beta-to-stable lineage replacement also needs an intermediate deployment whose bundle maximum is at or below the last common version; do not deploy a diverging stable bundle while a beta migration at or above the divergence is still applied. If there is no common lineage version, no intermediate `pgmigrate` target exists; keep a compatible image or use the planned reset or out-of-place transition described above. Down scripts can destroy data even when they are syntactically valid; use backups and expand/contract migrations for data-preserving rollouts.

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
