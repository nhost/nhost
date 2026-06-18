#!/usr/bin/env bash
# Sets up the isolated metadata store for the Hasura <-> Constellation metadata
# parity tests (integration/metadata_parity_test.go).
#
# Two engines cannot share one hdb_catalog.hdb_metadata row (their optimistic-
# concurrency writes would fight), so Constellation gets its OWN metadata DB
# ("cstl") inside the integration Postgres while it still introspects the same
# "local" data DB as Hasura. The DB only needs a minimal, valid seed to boot:
# the test harness resets both engines to Hasura's live baseline (replace_metadata)
# before every case, so the seed content here is irrelevant beyond "parseable".
#
# Prerequisites: `make dev-env-integration-up` has brought up the integration
# environment (so the Postgres container below exists).
#
# Usage (invoked by `make parity-env-up`):
#   bash integration/scripts/setup_parity_env.sh

set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-integration-postgres-1}"
META_DB="${META_DB:-cstl}"

# A minimal, valid Hasura v3 envelope — enough for Constellation's
# NewDatabaseBackedStore to bootstrap. The harness immediately replaces it with
# Hasura's real metadata on its first reset.
SEED='{"version":3,"sources":[]}'

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    echo "error: Postgres container '$PG_CONTAINER' is not running." >&2
    echo "       Run 'make dev-env-integration-up' first (or set PG_CONTAINER)." >&2
    exit 1
fi

echo "Resetting metadata DB '$META_DB' in container '$PG_CONTAINER'..."

# DROP/CREATE DATABASE cannot run inside a transaction or while connected, so
# issue them as standalone statements against the default DB.
docker exec "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS ${META_DB} WITH (FORCE);"
docker exec "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${META_DB};"

docker exec -i "$PG_CONTAINER" psql -U postgres -d "${META_DB}" -v ON_ERROR_STOP=1 <<SQL
CREATE SCHEMA IF NOT EXISTS hdb_catalog;
CREATE TABLE hdb_catalog.hdb_metadata (
  id               integer PRIMARY KEY,
  metadata         json    NOT NULL,
  resource_version integer NOT NULL DEFAULT 1 UNIQUE
);
INSERT INTO hdb_catalog.hdb_metadata (id, metadata, resource_version)
VALUES (1, '${SEED}'::json, 1);
SQL

echo "Done. Constellation can now boot in DB-source mode against '${META_DB}'."
