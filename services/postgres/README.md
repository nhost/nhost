# postgres

## Plugins

See [plugins.md](./plugins.md). Changes to this manifest also regenerate
`docs/src/content/docs/products/database/extensions.mdx`; follow the
[documentation regeneration instructions](../../docs/README.md#generated-documentation).

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
