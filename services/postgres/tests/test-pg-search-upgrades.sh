#!/bin/sh

set -eu

# Exercise the real startup upgrade functions on an existing physical volume.
# Override the target image to test the pinned upstream runtime without rebuilding
# all image extensions; normal CI uses the image running in postgres-tests.
script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
if [ -n "${POSTGRES_UPGRADE_TO_IMAGE:-}" ]; then
    current_image=$POSTGRES_UPGRADE_TO_IMAGE
else
    current_image=$(docker inspect --format '{{.Config.Image}}' "${1:-postgres-tests}")
fi
if [ -n "${POSTGRES_UPGRADE_FROM_IMAGE:-}" ]; then
    previous_image=$POSTGRES_UPGRADE_FROM_IMAGE
else
    pg_major=$(docker run --rm --user postgres --entrypoint postgres "$current_image" --version |
        awk '{split($3, version, "."); print version[1]}')
    case $pg_major in
    17) previous_image=nhost/postgres:17.11-20260930-1 ;;
    18) previous_image=nhost/postgres:18.6-20260930-1 ;;
    *)
        echo "No pg_search 0.25 upgrade source for PostgreSQL $pg_major" >&2
        exit 1
        ;;
    esac
fi

old_container=postgres-search-upgrade-old-$$
new_container=postgres-search-upgrade-new-$$
volume=postgres-search-upgrade-data-$$
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pg-search-upgrade.XXXXXX")
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if [ "$result" -ne 0 ]; then
        for file in "$test_dir"/*.log; do
            if [ -f "$file" ]; then cat "$file" >&2; fi
        done
        docker logs "$old_container" >&2 2>/dev/null || true
        docker logs "$new_container" >&2 2>/dev/null || true
    fi
    docker rm -fv "$old_container" "$new_container" >/dev/null 2>&1 || true
    docker volume rm -f "$volume" >/dev/null 2>&1 || true
    rm -rf "$test_dir"
    exit "$result"
}
trap cleanup EXIT
trap 'exit 143' HUP INT TERM

wait_for_database() {
    container=$1
    for _ in $(seq 1 120); do
        if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then
            echo "PostgreSQL exited before becoming available" >&2
            return 1
        fi
        if docker exec "$container" pg_isready -q -U postgres -d local 2>/dev/null; then return 0; fi
        sleep 0.5
    done
    echo "PostgreSQL did not become available" >&2
    return 1
}

run_upgrade() {
    docker exec "$new_container" sh -c '
        set -eu
        sed '\''$ { /^main$/d; }'\'' /upgrade/init.sh > /tmp/postgresql/init-functions.sh
        . /tmp/postgresql/init-functions.sh
        POSTGRES_DB=local
        update_extensions_all_databases
    '
}

psql_target() {
    docker exec -i "$new_container" psql -X -U postgres -d local -v ON_ERROR_STOP=1 "$@"
}

docker volume create "$volume" >/dev/null
docker run -d --name "$old_container" --env POSTGRES_DEV_INSECURE=1 \
    --volume "$volume:/var/lib/postgresql/data/pgdata" "$previous_image" >/dev/null
wait_for_database "$old_container"
# This setting is the final statement of the old image's Nhost startup SQL.
source_ready=false
for _ in $(seq 1 120); do
    if docker exec "$old_container" psql -X -qAt -U postgres -d local \
        -c "SELECT EXISTS (SELECT FROM pg_roles WHERE rolname='nhost_storage_admin' AND 'search_path=public'=ANY(rolconfig))" \
        2>/dev/null | grep -qx t; then
        source_ready=true
        break
    fi
    sleep 0.5
done
if [ "$source_ready" != true ]; then
    echo "The source image did not finish initialization" >&2
    exit 1
fi
docker exec -i "$old_container" psql -X -U postgres -d local -v ON_ERROR_STOP=1 -f - \
    <"$script_dir/pg-search-upgrade-source.sql" >"$test_dir/source.log" 2>&1
# PID 1 can exit after PostgreSQL stops but before docker exec returns, killing
# pg_ctl with 137. Require a clean container exit rather than that racing status.
docker exec "$old_container" pg_ctl stop --pgdata=/var/lib/postgresql/data/pgdata --mode=fast --wait >/dev/null 2>&1 || true
source_stopped=false
for _ in $(seq 1 120); do
    if [ "$(docker inspect --format '{{.State.Running}}' "$old_container")" = false ]; then
        source_stopped=true
        break
    fi
    sleep 0.5
done
if [ "$source_stopped" != true ] || [ "$(docker inspect --format '{{.State.ExitCode}}' "$old_container")" -ne 0 ]; then
    echo "The source container did not stop cleanly" >&2
    exit 1
fi
docker rm -v "$old_container" >/dev/null

# Start only PostgreSQL so we can inject a failed upgrade and retry explicitly.
# Both this fixture and the real entrypoint invoke update_extensions_all_databases.
docker run -d --name "$new_container" --user postgres --entrypoint sh \
    --env PGDATA=/var/lib/postgresql/data/pgdata --env PGHOST=/tmp/postgresql \
    --volume "$volume:/var/lib/postgresql/data/pgdata" \
    --volume "$script_dir/../postgres/bin/init.sh:/upgrade/init.sh:ro" \
    --volume "$script_dir/../postgres/bin/upgrade-pg-search.sql:/bin/upgrade-pg-search.sql:ro" \
    "$current_image" -c 'mkdir -p /tmp/postgresql; exec postgres -D "$PGDATA" \
        -c shared_preload_libraries=pg_search -c unix_socket_directories=/tmp/postgresql \
        -c listen_addresses= -c archive_mode=off' >/dev/null
wait_for_database "$new_container"
run_upgrade >"$test_dir/failed-upgrade.log" 2>&1
grep -q 'deliberate pg_search maintenance failure' "$test_dir/failed-upgrade.log"
grep -q 'Rebuilding pg_search index' "$test_dir/failed-upgrade.log"
grep -q 'Failed to update extension pg_search in database local; continuing startup' "$test_dir/failed-upgrade.log"
psql_target -f - <<'SQL'
DO $$
BEGIN
    IF (SELECT extversion FROM pg_extension WHERE extname='pg_search') <> '0.25.11' THEN
        RAISE EXCEPTION 'failed maintenance committed the extension version';
    END IF;
    IF EXISTS (SELECT FROM pg_search_upgrade_before AS before LEFT JOIN pg_class AS current USING(oid)
        WHERE current.oid IS NULL OR before.relfilenode <> current.relfilenode
            OR before.reloptions IS DISTINCT FROM current.reloptions) THEN
        RAISE EXCEPTION 'failed maintenance did not roll back earlier index changes';
    END IF;
END;
$$;
DROP EVENT TRIGGER fail_pg_search_upgrade;
DROP FUNCTION fail_pg_search_upgrade();
SQL

# A failure in one database must not prevent another database's upgrade.
other_node=$(docker exec --env 'PGDATABASE=search=old' "$new_container" psql -X -qAt -U postgres \
    -v ON_ERROR_STOP=1 -c 'SELECT relfilenode FROM pg_class WHERE oid='\''vector_idx'\''::regclass')
docker exec -i --env 'PGDATABASE=search=old' "$new_container" psql -X -U postgres -v ON_ERROR_STOP=1 -f - <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_extension AS installed JOIN pg_available_extensions AS available
        ON available.name=installed.extname WHERE installed.extname='pg_search' AND installed.extversion=available.default_version)
        OR EXISTS (SELECT FROM before_upgrade AS before JOIN pg_class AS current USING(oid)
            WHERE before.relfilenode=current.relfilenode) THEN
        RAISE EXCEPTION 'independent database did not finish upgrading';
    END IF;
    PERFORM * FROM paradedb.vector_info('vector_idx'::regclass,'embedding');
END;
$$;
SQL

run_upgrade >"$test_dir/retry.log" 2>&1
if grep -q 'Failed to update extension pg_search' "$test_dir/retry.log"; then
    echo "pg_search maintenance did not succeed on retry" >&2
    exit 1
fi
psql_target -f - <"$script_dir/pg-search-upgrade-check.sql"
run_upgrade >"$test_dir/restart.log" 2>&1
psql_target -f /bin/upgrade-pg-search.sql
if grep -q 'Rebuilding pg_search index\|Resetting obsolete pg_search options' "$test_dir/restart.log"; then
    echo "an ordinary restart repeated pg_search maintenance" >&2
    exit 1
fi
psql_target -f - <<'SQL'
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_search_second_start_before AS before LEFT JOIN pg_class AS current USING(oid)
        WHERE current.oid IS NULL OR before.relfilenode <> current.relfilenode
            OR before.reloptions IS DISTINCT FROM current.reloptions) THEN
        RAISE EXCEPTION 'current-version startup modified indexes';
    END IF;
END;
$$;
SQL
test "$other_node" = "$(docker exec --env 'PGDATABASE=search=old' "$new_container" psql -X -qAt -U postgres \
    -v ON_ERROR_STOP=1 -c 'SELECT relfilenode FROM pg_class WHERE oid='\''vector_idx'\''::regclass')"
test "$(docker exec "$new_container" psql -X -qAt -U postgres -d postgres \
    -v ON_ERROR_STOP=1 -c "SELECT NOT EXISTS (SELECT FROM pg_extension WHERE extname IN ('pg_search','vector'))")" = t
printf '%s\n' 'PASS pg_search upgrade: atomic rollback/retry, defaults, vector storage, index identity/metadata, partitions and unchanged repeat startup'
