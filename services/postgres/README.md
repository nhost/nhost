# postgres

## Plugins
| Name | Version | Comment |
|------|---------|---------|
| address_standardizer | 3.6.1 | Used to parse an address into constituent elements. Generally used to support geocoding address normalization step. |
| address_standardizer_data_us | 3.6.1 | Address Standardizer US dataset example |
| amcheck | 1.5 | functions for verifying relation integrity |
| autoinc | 1.0 | functions for autoincrementing fields |
| bloom | 1.0 | bloom access method - signature file based index |
| btree_gin | 1.3 | support for indexing common datatypes in GIN |
| btree_gist | 1.8 | support for indexing common datatypes in GiST |
| citext | 1.8 | data type for case-insensitive character strings |
| cube | 1.5 | data type for multidimensional cubes |
| dblink | 1.2 | connect to other PostgreSQL databases from within a database |
| dict_int | 1.0 | text search dictionary template for integers |
| dict_xsyn | 1.0 | text search dictionary template for extended synonym processing |
| earthdistance | 1.2 | calculate great-circle distances on the surface of the Earth |
| file_fdw | 1.0 | foreign-data wrapper for flat file access |
| fuzzystrmatch | 1.2 | determine similarities and distance between strings |
| hstore | 1.8 | data type for storing sets of (key, value) pairs |
| http | 1.7 | HTTP client for PostgreSQL, allows web page retrieval inside the database. |
| hypopg | 1.4.2 | Hypothetical indexes for PostgreSQL |
| insert_username | 1.0 | functions for tracking who changed a table |
| intagg | 1.1 | integer aggregator and enumerator (obsolete) |
| intarray | 1.5 | functions, operators, and index support for 1-D arrays of integers |
| ip4r | 2.4 | |
| isn | 1.3 | data types for international product numbering standards |
| lo | 1.2 | Large Object maintenance |
| ltree | 1.3 | data type for hierarchical tree-like structures |
| moddatetime | 1.0 | functions for tracking last modification time |
| pageinspect | 1.13 | inspect the contents of database pages at a low level |
| pg_buffercache | 1.6 | examine the shared buffer cache |
| pg_cron | 1.6 | Job scheduler for PostgreSQL |
| pg_freespacemap | 1.3 | examine the free space map (FSM) |
| pg_hashids | 1.3 | pg_hashids |
| pg_ivm | 1.13 | incremental view maintenance on PostgreSQL |
| pg_jsonschema | 0.3.3 | pg_jsonschema |
| pg_logicalinspect | 1.0 | functions to inspect logical decoding components |
| pg_prewarm | 1.2 | prewarm relation data |
| pg_repack | 1.5.3 | Reorganize tables in PostgreSQL databases with minimal locks |
| pg_search | 0.21.1 | pg_search: Full text search for PostgreSQL using BM25 |
| pg_squeeze | 1.9 | A tool to remove unused space from a relation. |
| pg_stat_statements | 1.12 | track planning and execution statistics of all SQL statements executed |
| pg_surgery | 1.0 | extension to perform surgery on a damaged relation |
| pg_trgm | 1.6 | text similarity measurement and index searching based on trigrams |
| pg_visibility | 1.2 | examine the visibility map (VM) and page-level visibility info |
| pg_walinspect | 1.1 | functions to inspect contents of PostgreSQL Write-Ahead Log |
| pgcrypto | 1.4 | cryptographic functions |
| pgmq | 1.8.0 | A lightweight message queue. Like AWS SQS and RSMQ but on Postgres. |
| pgrouting | 4.0.0 | pgRouting Extension |
| pgrowlocks | 1.2 | show row-level locking information |
| pgstattuple | 1.5 | show tuple-level statistics |
| plpgsql | 1.0 | PL/pgSQL procedural language |
| postgis | 3.6.1 | PostGIS geometry and geography spatial types and functions |
| postgis_raster | 3.6.1 | PostGIS raster types and functions |
| postgis_tiger_geocoder | 3.6.1 | PostGIS tiger geocoder and reverse geocoder |
| postgis_topology | 3.6.1 | PostGIS topology spatial types and functions |
| postgres_fdw | 1.2 | foreign-data wrapper for remote PostgreSQL servers |
| refint | 1.0 | functions for implementing referential integrity (obsolete) |
| seg | 1.4 | data type for representing line segments or floating-point intervals |
| sslinfo | 1.2 | information about SSL certificates |
| tablefunc | 1.0 | functions that manipulate whole tables, including crosstab |
| tcn | 1.0 | Triggered change notifications |
| timescaledb | 2.24.0 | Enables scalable inserts and complex queries for time-series data |
| tsm_system_rows | 1.0 | TABLESAMPLE method which accepts number of rows as a limit |
| tsm_system_time | 1.0 | TABLESAMPLE method which accepts time in milliseconds as a limit |
| unaccent | 1.1 | text search dictionary that removes accents |
| uuid-ossp | 1.1 | generate universally unique identifiers (UUIDs) |
| vector | 0.8.1 | vector data type and ivfflat and hnsw access methods |
| xml2 | 1.2 | XPath querying and XSLT |


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
