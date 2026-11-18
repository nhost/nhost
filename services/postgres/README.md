# postgres

## Plugins

See [plugins.md](./plugins.md). Changes to this manifest also regenerate
`docs/src/content/docs/products/database/extensions.mdx`; follow the
[documentation regeneration instructions](../../docs/README.md#generated-documentation).

## Temporary files in the image

The entrypoint runs as the `postgres` user (UID 999). The image's `/tmp` is
root-owned and not writable by that user; use `/tmp/postgresql` for image-side
temporary files. PITR preflight defaults there unless `TMPDIR` is explicitly set.

## First-boot shutdown

On a new cluster, SIGTERM after `initdb` succeeds is deferred until PostgreSQL
starts and `/initdb.d` first-boot SQL finishes, then PostgreSQL stops cleanly.
This only helps when startup and SQL finish within Docker's stop timeout;
SIGKILL, OOM, a timeout, or a fatal script failure can still leave a partially
initialized cluster. `PG_VERSION` alone does not prove the SQL finished, and
first-boot SQL is not automatically replayed on restart (it may be
non-idempotent). Inspect or restore interrupted clusters manually; the
entrypoint never deletes unknown data to retry them.
SQL statement errors retain the existing continue-on-error behavior.

The CLI mounts its volume directly at `PGDATA`, so removing `PGDATA` itself
would fail after deleting its contents. Files beside `PGDATA` also do not
necessarily survive container recreation; test lifecycle changes against this
layout rather than relying on a marker outside the mounted volume.

## Extension upgrades

Keep the startup catalog probe and TimescaleDB update in separate sessions.
Collation repair and startup catalog queries before the upgrade must set
`timescaledb.disable_load=on` because an installed old version might reference
a library that the new image no longer bundles, while
`ALTER EXTENSION timescaledb UPDATE` must be the first command in a fresh
session.

Extension SQL versions that have shipped are immutable. If the pg_jsonschema
checker fails after a source-pin bump, pin a revision with matching generated
SQL or introduce a new extension SQL version and upgrade step so existing
volumes receive the change.

PostGIS 3.7 no longer bundles the address standardizer or TIGER geocoder.
Their standalone packages keep `address_standardizer`,
`address_standardizer_data_us`, and `postgis_tiger_geocoder` available. The
address-standardizer package exposes the upstream update script for the
previous bundled 3.6 versions; the TIGER package ships its own legacy upgrade
paths. Keep these paths when updating either standalone source.

TIGER 2025.x no longer adds `tiger` to the database `search_path` on fresh
installs; upgraded volumes retain their existing database setting. Its installer
also leaves `tiger` first in the session path, so migrations must run
`RESET search_path` before creating later objects or explicitly select their schemas. Fresh databases
need a persistent path with `tiger` after `public` for geocoder functions to work.
See the [TIGER setup and upgrade guidance](https://docs.nhost.io/products/database/extensions#postgis_tiger_geocoder)
for the migration SQL and reconnection requirements.

The core `postgis`, `postgis_raster`, and `postgis_topology` extensions also
need old-version `--ANY` tag links: bulk upgrade installation is disabled in
`extensions/postgis.nix`. Retain every previously shipped PG17/PG18 version
when bumping PostGIS. `tests/plugins.sql` checks catalog update paths, and
`make check-extension-upgrades` exercises startup upgrades on an existing volume,
including spatial data and indexes.

## Tests

Keep check scripts and fixtures under `tests/`: `project.nix` includes this
directory in the check fileset, so changes to those files trigger CI checks.
Git-backed flake evaluations omit new, untracked files; use
`git add -N <paths>` to make them visible before running checks.

The PostgreSQL Nix check runs the `tests/test_*.py` suite with Python's
`unittest`. For pg_jsonschema checker changes, also build a Linux
`postgres-pg18` package to exercise `postInstall` against generated SQL.
pgrx inserts comments between SQL tokens;
after stripping them, equivalent definitions can differ in whitespace next to
parentheses or commas, so normalization must account for punctuation spacing.

For linker-only `pg_search` changes, a small native Rust `cdylib` probe using
the candidate's linker input and upstream Linux `-fuse-ld=lld` flag can isolate
RUNPATH handling without rebuilding the extension. Link a shared library
PostgreSQL does not preload (for example OpenBLAS), inspect RUNPATH/NEEDED and
the linker identity, then load it with `LD_LIBRARY_PATH` and `LD_PRELOAD` unset.
Use a compiler-enabled stdenv for the probe: Nix's `runCommand` defaults to
`stdenvNoCC`. This is not a full extension or image test.

When checking pgrx toolchain changes on a small Linux builder (for example,
a 6 GiB Lima VM), build `packages.aarch64-linux.postgres-pg18` and
`packages.x86_64-linux.postgres-pg18` sequentially. Parallel full builds,
especially x86_64 through QEMU, can exhaust RAM and stall in swap while
compiling pg_search. Its release build uses LTO and can exceed 6 GiB when
running eight build jobs. Nix uses the builder's configured core count (or
all available cores when set to 0), so limit jobs on memory-constrained
builders at invocation time, for example from the repository root:

```sh
nix build --cores 2 --max-jobs 1 .#packages.aarch64-linux.postgres-pg18
```

For the image target, from `services/postgres` use
`make build-docker-image docker-build-options='--cores 2 --max-jobs 1'`.
On larger builders, leave the core count uncapped.

## Options

These image environment variables are also mapped to Nhost Cloud project settings:

```
ARCHIVE_TIMEOUT=300
MAX_CONNECTIONS=100
SHARED_BUFFERS=128MB
EFFECTIVE_CACHE_SIZE=4GB
MAINTENANCE_WORK_MEM=64MB
CHECKPOINT_COMPLETION_TARGET=0.9
WAL_BUFFERS=-1
DEFAULT_STATISTICS_TARGET=100
RANDOM_PAGE_COST=4.0
EFFECTIVE_IO_CONCURRENCY=1
WORK_MEM=4MB
HUGE_PAGES=try
MIN_WAL_SIZE=80MB
MAX_WAL_SIZE=1GB
MAX_WORKER_PROCESSES=8
MAX_PARALLEL_WORKERS_PER_GATHER=2
MAX_PARALLEL_WORKERS=8
MAX_PARALLEL_MAINTENANCE_WORKERS=2
JIT=on
WAL_LEVEL=replica
MAX_WAL_SENDERS=10
MAX_REPLICATION_SLOTS=10
TRACK_IO_TIMING=off
```

### Additional configurable settings

The following image environment variables are also configurable in Nhost Cloud
under `postgres.settings` (or `postgres.settings.extensions` for extension
settings). The entrypoint renders `/tmp/postgresql/postgresql.conf` from these
variables at startup; changes require a container restart. Keep image defaults
unless the workload needs a different value.

| Environment variable | Default | PostgreSQL setting / purpose |
| --- | --- | --- |
| `WAL_COMPRESSION` | `off` | `wal_compression`: reduce WAL volume at a CPU cost; confirm the chosen codec is supported by the image. |
| `MAX_SLOT_WAL_KEEP_SIZE` | `-1` | `max_slot_wal_keep_size`: limit WAL retained by replication slots (in MB); a finite limit may invalidate a lagging slot/replica. |
| `CHECKPOINT_TIMEOUT` | `5min` | `checkpoint_timeout`: maximum time between automatic checkpoints. |
| `LOG_MIN_DURATION_STATEMENT` | `-1` | `log_min_duration_statement`: log slow statements; `-1` disables (milliseconds if unitless). |
| `LOG_AUTOVACUUM_MIN_DURATION` | `10min` | `log_autovacuum_min_duration`: log slow autovacuum activity; `-1` disables. |
| `LOG_TEMP_FILES` | `-1` | `log_temp_files`: log temporary files over a threshold; `-1` disables (kilobytes if unitless). |
| `SHARED_PRELOAD_LIBRARIES` | `pg_stat_statements,pg_cron,timescaledb,pg_squeeze,pg_search` | Shared libraries loaded at PostgreSQL startup. Keep required modules when overriding; not every bundled extension has a preloadable library. |
| `PG_STAT_STATEMENTS_MAX` | `5000` | `pg_stat_statements.max`: maximum distinct statements tracked; uses shared memory. |
| `PG_STAT_STATEMENTS_TRACK` | `top` | `pg_stat_statements.track`: `top`, `all` (includes nested statements), or `none`. |
| `PG_STAT_STATEMENTS_TRACK_PLANNING` | `off` | `pg_stat_statements.track_planning`: track planning time; can add overhead. |
| `CRON_TIMEZONE` | `GMT` | `cron.timezone`: timezone used for job schedules. |
| `CRON_MAX_RUNNING_JOBS` | `32` | `cron.max_running_jobs`: concurrent job limit; account for connections/background workers. |
| `CRON_LOG_RUN` | `on` | `cron.log_run`: record job runs; `cron.job_run_details` is not automatically pruned. |
| `PG_DURABLE_MAX_USER_CONNECTIONS` | `10` | `pg_durable.max_user_connections`: concurrent workflow SQL execution connections. |
| `PG_DURABLE_RETENTION_DAYS` | `30` | `pg_durable.retention_days`: days to retain terminal workflow instances. |
| `PG_DURABLE_LOG_WORKFLOW_SQL` | `off` | `pg_durable.log_workflow_sql`: substituted SQL may contain secrets; opt in only when needed. Overrides the extension's `on` default. |
| `TIMESCALEDB_MAX_BACKGROUND_WORKERS` | `16` | `timescaledb.max_background_workers`: TimescaleDB job-worker cap; budget against `MAX_WORKER_PROCESSES` and other extensions. |

Enabling `LOG_MIN_DURATION_STATEMENT` can log sensitive query text and bind
parameters, especially pg_durable workflow variables, even with
`PG_DURABLE_LOG_WORKFLOW_SQL=off` (which only disables pg_durable's own worker
SQL traces). PostgreSQL error-statement logging can also record sensitive SQL;
treat these logs as sensitive when queries or workflows handle secrets.

The image also supports `PG_DURABLE_HTTP_SECURITY` (not mapped to a Cloud
setting). It defaults to `unrestricted` to preserve the former
`http-allow-all` build policy after upgrading to pg_durable 0.2.9. This permits
HTTP(S) requests to arbitrary destinations, including private networks. Set it
to `restricted` to enforce HTTPS and the upstream IP restrictions, with a default
allow-list limited to specific Azure service subdomains and `api.github.com`,
or `disabled` to block pg_durable HTTP requests. Check workflow destinations
before switching to `restricted`: requests to other hosts will fail. The image
has no environment variable for `pg_durable.http_allowed_domains`; see the
[HTTP egress guidance](https://docs.nhost.io/products/database/extensions#http-egress-and-access-control)
for superuser allow-list overrides and their PITR restore requirements.
Changes require a PostgreSQL restart; HTTP function privileges, TLS verification,
and redirect blocking remain enforced in enabled modes.

The image and Cloud defaults in the table above match whether or not
`[postgres.settings]` exists. Both omit `pg_durable` and `pg_ivm`; include either in
`sharedPreloadLibraries` (or `SHARED_PRELOAD_LIBRARIES` for the image) alongside
all other required libraries if you use it. Preloading an extension does not
run `CREATE EXTENSION`. The fixed `output_plugin_libraries` allowlist permits
PostgreSQL's `pgoutput` and `test_decoding` plus the bundled `pg_squeeze`
logical-decoding output plugin. It does not preload libraries or enable logical
replication; adding a plugin allows replication users to load it, so only trusted
output plugins belong there. For pg_squeeze, set `WAL_LEVEL=logical` before using
its logical-decoding based squeeze operations; the image defaults to `replica`.

### PITR restore safety

When `PITR_BASEBACKUP` is set, startup first uses `wal-g backup-list` to check
that backup storage is reachable and that the requested backup is listed. For
the symbolic `LATEST` selector, the check only confirms that at least one backup
is available. If this preflight fails, the existing `PGDATA` is preserved.

After a successful preflight, startup removes `PGDATA` and runs
`wal-g backup-fetch` directly into that path. This avoids requiring space for two
copies of the database, but it is not atomic: a later fetch failure destroys the
old cluster and may leave a partial restore. The preflight therefore reduces
obvious failures; it does not guarantee that the backup can be downloaded.

PITR restores promote at the recovery target by default. The restore entrypoint
then stops PostgreSQL, so a normal start on the same `PGDATA` retains the
selected point in time. `PITR_TARGET_ACTION=shutdown` is available for explicit
recovery workflows, but a normal start after shutdown can replay past the target.

SIGTERM during a PITR restore stops PostgreSQL cleanly but exits non-zero;
the restore is incomplete and must be retried rather than starting the partial
cluster normally. A completed shutdown-target restore still exits zero.

Following settings are available in the image but not directly configurable:

```
ARCHIVE_MODE=off
ARCHIVE_COMMAND=wal-g wal-push %p
RESTORE_COMMAND=wal-g wal-fetch %f %p
SYNCHRONOUS_COMMIT=on
HOT_STANDBY=on
PITR_TARGET_ACTION=promote
PITR_TARGET_TIMELINE=latest
```
