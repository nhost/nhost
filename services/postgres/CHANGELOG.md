## CHANGELOG

### {16.13,17.9,18.3}-20260320-1

- Updated postgres to 16.13, 17.9 and 18.3
- Updated extensions:
  - pg_search: 0.21.1 → 0.22.2
  - pgmq: 1.8.0 → 1.11.0
  - pgvector: 0.8.1 → 0.8.2
  - pgrouting: 4.0.0 → 4.0.1
  - postgis: 3.6.1 → 3.6.2
  - timescaledb: 2.24.0 → 2.25.2
- Enabled icu on pg_search extension

### {16.11,17.7,18.1}-20260119-1

- Added support for PostgreSQL 18.1
- Dropped support for PostgreSQL 14 and 15
- Updated extensions:
  - pg_jsonschema: 0.3.3 → 0.4.0-rc1
  - pg_search: 0.20.4 → 0.21.1
- Added new extensions:
  - pgrouting: 4.0.0

### {14.20,15.15,16.11,17.7}-20251217-1

- Updated postgres to 14.20, 15.15, 16.11 and 17.7
- Updated extensions:
  - pg_cron: 1.6 → 1.6.7
  - pg_ivm: 1.11 → 1.13
  - pg_repack: 1.5.2 → 1.5.3
  - pg_search: 0.17.2 → 0.20.4
  - pg_squeeze: 1.8 → 1.9.1
  - pgmq: 1.6.1 → 1.8.0
  - postgis: 3.5.3 → 3.6.1
  - timescaledb: 2.21.1 → 2.24.0
  - vector: 0.8.0 → 0.8.1

### {14.18,15.13,16.9,17.5}-20250728-1

- Updated postgres to 14.18, 15.13, 16.9 and 17.5
- Updated extensions:
  - hypog: 1.4.1 → 1.4.2
  - pg_ivm: 1.10 → 1.11
  - pgmq: 1.5.1 → 1.6.1
  - pgsql-http: 1.6.3 → 1.7.0
  - postgis: 3.5.2 → 3.5.3
  - timescaledb: 2.19.3 → 2.21.1
- New extensions:
  - pg_search: 0.17.2
- New options:
  - TRACK_IO_TIMING

### {14.17,15.12,16.8,17.4}-20250530-1

- Fixes to http extension that caused issues when installing it for the first time under certain conditions

### {14.17,15.12,16.8,17.4}-20250506-1

- Updated postgres to 14.17, 15.12, 16.8 and 17.4
- Updated extensions:
  - earth_distance: 1.1 → 1.2
  - pg_ivm: 1.9 → 1.10
  - pgmq: 1.5.0 → 1.5.1
  - timescaledb: 2.18.9 → 2.19.3
- Updated wal-g to 3.0.7

### {14.15,15.10,16.6,17.2}-20250311-1

- Minor internal improvements

### {14.15,15.10,16.6,17.2}-20250226-1

- Added support for PiTR
  - Added WAL-G to the image
  - Added following configurable environment variables:
    - ARCHIVE_TIMEOUT
  - added the following system environment variables:
    - ARCHIVE_MODE
    - ARCHIVE_COMMAND
    - RESTORE_COMMAND
    - CHECKPOINT_TIMEOUT
    - SYNCHRONOUS_COMMIT
    - HOT_STANDBY
    - PITR_TARGET_ACTION
    - PITR_TARGET_TIMELINE

### {14.15,15.10,16.6,17.2}-20250131-1

- Added support for postgres 17.2
- Updated postgres to 14.15, 15.10, 16.6
- Updated extensions:
    - address_standardizer: 3.5.0 → 3.5.2
    - address_standardizer_data_us: 3.5.0 → 3.5.2
    - amcheck: 1.3 → 1.4
    - btree_gist: 1.6 → 1.7
    - fuzzystrmatch: 1.1 → 1.2
    - ltree: 1.2 → 1.3
    - pageinspect: 1.9 → 1.12
    - pg_buffercache: 1.3 → 1.5
    - pg_repack: 1.5.1 → 1.5.2
    - pg_squeeze: 1.7 → 1.8
    - pg_stat_statements: 1.9 → 1.11
    - pgmq: 1.4.5 → 1.5.0
    - postgis: 3.5.0 → 3.5.2
    - postgis_raster: 3.5.0 → 3.5.2
    - postgis_tiger_geocoder: 3.5.0 → 3.5.2
    - postgis_topology: 3.5.0 → 3.5.2
   - timescaledb: 2.17.2 → 2.18.0

### {14.13,15.8,16.4}-20250120-1

- fix: added pg_squeeze to shared_preload_libraries

### {14.13,15.8,16.4}-20250117-1

- Refresh collation version on startup
- Added pgmq extension

### {14.13,15.8,16.4}-20250108-1

- Added pg_jsonschema extension

### {14.13,15.8,16.4}-20241126-1

- Added pg_repack extension
- Updated pgvector to 0.8.0
- Updated timescaledb to 2.17.2
- Updated postgis to 3.5.0
- Updated pg_squeeze to 1.7


### {14.13,15.8,16.4}-20240930-1

- Added ip4r extension

### {14.13,15.8,16.4}-20240918-1

- Added pg_ivm plugin

### {14.13,15.8,16.4}-20240909-1

- Bump versions to 14.13, 15.8, 16.4
- fix: update timescaledb on startup if necessary

### {14.11,15.6,16.2}-20240901-1

- Added pg_hashids plugin
- Added pg_squeeze plugin
- Updated pgvector to 0.7.4
- Updated timescaledb to 2.14.2
- Update hypopg to 1.4.1

### {14.11,15.6,16.2}-20240717-1

- change default locales to UTF-8

### {14.11,15.6,16.2}-20240515-1

- first multi-version image

### 14.11-20240515-1

- Build improvements to support multiple major versions

### 14.11-20240429-1

- Upgraded postgres to 14.11

### 14.6-20240422-1

- set search_path to public for auth/storage users

### 14.6-20240412-1

- amend permissions for auth/storage users so they can trigger events
- update pgvector to 0.6.2
- update timescaledb to 2.14.2
- update postgis to 3.4.2

### 14.6-20240129-1

- clean core dumps automatically

### 14.6-20231218-1

- Added wal settings
- plugins: upgraded to following versions:
  - postgis: 3.4.1

### 14.6-20231031-1

- plugins: upgraded to following versions:
  - pgvector: 0.5.1
  - cron: 1.6.2
  - timescaldb: 2.12.2

### 14.6-20231018-1

- cloud: minor internal improvements
- plugins: added pgsql-http plugin

