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
The startup catalog queries must set `timescaledb.disable_load=on` because an installed old
version might reference a library that the new image no longer bundles, while
`ALTER EXTENSION timescaledb UPDATE` must be the first command in a fresh
session.

## Tests

Keep check scripts and fixtures under `tests/`: `project.nix` includes this
directory in the check fileset, so changes to those files trigger CI checks.
Git-backed flake evaluations omit new, untracked files; use
`git add -N <paths>` to make them visible before running checks.

The PostgreSQL Nix check runs `tests/test_pg_jsonschema_upgrade.py` with
Python's `unittest`. For pg_jsonschema checker changes, also build a Linux
`postgres-pg18` package to exercise `postInstall` against generated SQL.
pgrx inserts comments between SQL tokens;
after stripping them, equivalent definitions can differ in whitespace next to
parentheses or commas, so normalization must account for punctuation spacing.

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

Following env vars are available in the image (to be set in an Nhost cloud project via settings):

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

SIGTERM during a PITR restore stops PostgreSQL cleanly but exits non-zero;
the restore is incomplete and must be retried rather than starting the partial
cluster normally. A completed shutdown-target restore still exits zero.

Following settings are available in the image but not directly configurable:

```
ARCHIVE_MODE=off
ARCHIVE_COMMAND=wal-g wal-push %p
RESTORE_COMMAND=wal-g wal-fetch %f %p
CHECKPOINT_TIMEOUT=5min
SYNCHRONOUS_COMMIT=on
HOT_STANDBY=on
PITR_TARGET_ACTION=shutdown
PITR_TARGET_TIMELINE=latest
```
