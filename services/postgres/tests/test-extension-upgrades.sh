#!/bin/sh

set -eu

source_container=${1:-postgres-tests}
previous_image=${POSTGRES_UPGRADE_FROM_IMAGE:-nhost/postgres:18.4-20260610-1}
script_dir=$(dirname "$0")
script_dir=$(cd "$script_dir" >/dev/null && pwd)
upgrade_source="$script_dir/extension-upgrade-source.sql"
current_image=$(docker inspect --format '{{.Config.Image}}' "$source_container")
old_container="postgres-extension-upgrade-old-$$"
new_container="postgres-extension-upgrade-new-$$"
volume="postgres-extension-upgrade-data-$$"

cleanup() {
    docker rm -fv "$old_container" "$new_container" >/dev/null 2>&1 || true
    docker volume rm -f "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

wait_for_source_initialization() {
    container=$1

    for _ in $(seq 1 120); do
        if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then
            echo "PostgreSQL stopped before source initialization completed in $container" >&2
            docker logs "$container" >&2
            return 1
        fi

        if docker exec "$container" \
            psql -X -qAt -U postgres -d local \
            -c "SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nhost_hasura')" \
            2>/dev/null | grep -qx t; then
            # The previous image predates the explicit completion log. Its
            # core-dump cleanup loop starts only after all init scripts finish.
            if docker top "$container" -eo pid,comm,args 2>/dev/null |
                grep -q 'sleep 60'; then
                return 0
            fi
        fi
        sleep 0.5
    done

    echo "PostgreSQL did not complete source initialization in $container" >&2
    docker logs "$container" >&2
    return 1
}

wait_for_initialization() {
    container=$1

    for _ in $(seq 1 120); do
        if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then
            echo "PostgreSQL stopped before initialization completed in $container" >&2
            docker logs "$container" >&2
            return 1
        fi

        if docker exec "$container" pg_isready -q 2>/dev/null &&
            docker logs "$container" 2>&1 | grep -q 'PostgreSQL initialization complete'; then
            return 0
        fi
        sleep 0.5
    done

    echo "PostgreSQL did not complete initialization in $container" >&2
    docker logs "$container" >&2
    return 1
}

assert_no_missing_timescaledb_error() {
    container=$1

    if docker logs "$container" 2>&1 |
        grep -Eq 'ERROR:[[:space:]]+extension "timescaledb" does not exist'; then
        echo "TimescaleDB absence was logged as an error in $container" >&2
        docker logs "$container" >&2
        return 1
    fi
}

wait_for_initialization "$source_container"
assert_no_missing_timescaledb_error "$source_container"

docker volume create "$volume" >/dev/null
docker run -d --name "$old_container" \
    --env POSTGRES_DEV_INSECURE=1 \
    --volume "$volume:/var/lib/postgresql/data/pgdata" \
    "$previous_image" >/dev/null
wait_for_source_initialization "$old_container"

docker exec -i "$old_container" \
    psql -X -U postgres -d local -v ON_ERROR_STOP=1 -f - <"$upgrade_source"

# The previous entrypoint forwards TERM to a wrapper shell instead of the
# postmaster, so stop PostgreSQL directly to leave a clean upgrade source.
docker exec "$old_container" \
    pg_ctl stop --pgdata=/var/lib/postgresql/data/pgdata --mode=fast --wait \
    >/dev/null 2>&1 || true
for _ in $(seq 1 120); do
    if [ "$(docker inspect --format '{{.State.Running}}' "$old_container")" = false ]; then
        break
    fi
    sleep 0.5
done
if [ "$(docker inspect --format '{{.State.Running}}' "$old_container")" != false ]; then
    echo "The source container did not stop after PostgreSQL shut down" >&2
    docker logs "$old_container" >&2
    exit 1
fi
docker rm -v "$old_container" >/dev/null

docker run -d --name "$new_container" \
    --env POSTGRES_DEV_INSECURE=1 \
    --volume "$volume:/var/lib/postgresql/data/pgdata" \
    "$current_image" >/dev/null
wait_for_initialization "$new_container"
assert_no_missing_timescaledb_error "$new_container"

if docker logs "$new_container" 2>&1 | grep -q 'Collation repair failed'; then
    echo "Collation repair failed before the TimescaleDB upgrade" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! collation_repaired=$(docker exec "$new_container" \
    psql -X -qAt -U postgres -d local -v ON_ERROR_STOP=1 \
    -c "SELECT datcollversion = pg_database_collation_actual_version(oid)
        FROM pg_database WHERE datname = 'local'"); then
    echo "Could not inspect the collation version in local" >&2
    docker logs "$new_container" >&2
    exit 1
fi
if [ "$collation_repaired" != t ]; then
    echo "Collation repair did not refresh local on the upgrade boot" >&2
    docker logs "$new_container" >&2
    exit 1
fi

for database in postgres local; do
    if ! timescaledb_is_current=$(docker exec \
        --env PGOPTIONS='-c timescaledb.disable_load=on' \
        "$new_container" psql -X -qAt -U postgres -d "$database" \
        -v ON_ERROR_STOP=1 \
        -c "SELECT installed.extversion = available.default_version
            FROM pg_extension AS installed
            JOIN pg_available_extensions AS available
                ON available.name = installed.extname
            WHERE installed.extname = 'timescaledb'"); then
        echo "Could not inspect TimescaleDB in database $database" >&2
        docker logs "$new_container" >&2
        exit 1
    fi

    if [ "$timescaledb_is_current" != t ]; then
        echo "TimescaleDB was not upgraded to the default version in database $database" >&2
        docker logs "$new_container" >&2
        exit 1
    fi
done

if ! pg_search_dependencies_current=$(docker exec "$new_container" \
    psql -X -qAt -U postgres -d pg_search_without_vector \
    -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) = 2
            AND bool_and(installed.extversion = available.default_version)
        FROM pg_extension AS installed
        JOIN pg_available_extensions AS available
            ON available.name = installed.extname
        WHERE installed.extname IN ('pg_search', 'vector')"); then
    echo "Could not inspect pg_search and vector after the upgrade" >&2
    docker logs "$new_container" >&2
    exit 1
fi
if [ "$pg_search_dependencies_current" != t ]; then
    echo "pg_search and vector were not installed at their default versions in pg_search_without_vector" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! docker logs "$new_container" 2>&1 |
    grep -q 'WARNING: Failed to update extension ip4r in database extension_update_failure; continuing startup'; then
    echo "The non-fatal extension update failure was not reported" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! docker logs "$new_container" 2>&1 |
    grep -q 'WARNING: Failed to inspect extensions in database aaa_inspect_failure; continuing startup'; then
    echo "A database-specific inspection failure was not reported" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! invalid_database_skipped=$(docker exec "$new_container" \
    psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT datallowconn AND datconnlimit = -2 FROM pg_database WHERE datname = 'aaa_invalid'"); then
    echo "Could not inspect the invalid upgrade source database" >&2
    exit 1
fi
if [ "$invalid_database_skipped" != t ] ||
    docker logs "$new_container" 2>&1 | grep -q 'Failed to inspect extensions in database aaa_invalid'; then
    echo "The invalid database was not excluded from extension discovery" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! hstore_is_current=$(docker exec --env 'PGDATABASE=app=old' "$new_container" \
    psql -X -qAt -U postgres -v ON_ERROR_STOP=1 \
    -c "SELECT installed.extversion = available.default_version
        FROM pg_extension AS installed
        JOIN pg_available_extensions AS available ON available.name = installed.extname
        WHERE installed.extname = 'hstore'"); then
    echo "Could not inspect hstore in app=old" >&2
    docker logs "$new_container" >&2
    exit 1
fi
if [ "$hstore_is_current" != t ] ||
    ! docker logs "$new_container" 2>&1 | grep -q 'Updating extension hstore in database app=old'; then
    echo "hstore was not upgraded in the database named app=old" >&2
    docker logs "$new_container" >&2
    exit 1
fi

if ! search_path_restored=$(docker exec "$new_container" \
    psql -X -qAt -U postgres -d local -v ON_ERROR_STOP=1 \
    -c "SELECT 'search_path=public' = ANY(rolconfig)
        FROM pg_roles WHERE rolname = 'nhost_auth_admin'"); then
    echo "Could not inspect nhost_auth_admin settings" >&2
    exit 1
fi
if [ "$search_path_restored" != t ] ||
    docker logs "$new_container" 2>&1 | grep -q 'Nhost script execution failed'; then
    echo "Nhost SQL was skipped or failed after the extension inspection failure" >&2
    docker logs "$new_container" >&2
    exit 1
fi

docker exec -i "$new_container" \
    psql -X -U postgres -d local -v ON_ERROR_STOP=1 -1 -f - \
    <"$script_dir/plugins.sql"

echo "PostgreSQL upgraded extensions from $previous_image"
