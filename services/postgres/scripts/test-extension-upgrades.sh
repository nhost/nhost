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

for database in postgres local; do
    if ! docker logs "$new_container" 2>&1 |
        grep -q "Updating extension timescaledb in database $database"; then
        echo "TimescaleDB was not upgraded in database $database" >&2
        docker logs "$new_container" >&2
        exit 1
    fi
done

if ! docker logs "$new_container" 2>&1 |
    grep -q 'WARNING: Failed to update extension ip4r in database extension_update_failure; continuing startup'; then
    echo "The non-fatal extension update failure was not reported" >&2
    docker logs "$new_container" >&2
    exit 1
fi

docker exec -i "$new_container" \
    psql -X -U postgres -d local -v ON_ERROR_STOP=1 -1 -f - \
    <"$script_dir/../tests/plugins.sql"

echo "PostgreSQL upgraded extensions from $previous_image"
