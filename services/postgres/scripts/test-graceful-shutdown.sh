#!/bin/sh

set -eu

container=${1:-postgres-tests}
script_dir=$(dirname "$0")
script_dir=$(cd "$script_dir" >/dev/null && pwd)
init_script="$script_dir/../postgres/bin/init.sh"
repair_script="$script_dir/../postgres/bin/repair-collation.sh"
restart_logs=$(mktemp)
collation_restart_logs=$(mktemp)
collation_tmp_dir=$(mktemp -d)
collation_container="postgres-collation-shutdown-$$"
collation_volume="postgres-collation-shutdown-data-$$"
early_restart_logs=$(mktemp)
early_init_file=$(mktemp)
early_container="postgres-early-shutdown-$$"
client_log=$(mktemp)
client_pid=

cleanup() {
    if [ -n "$client_pid" ] && kill -0 "$client_pid" 2> /dev/null; then
        kill "$client_pid" 2> /dev/null || true
        wait "$client_pid" 2> /dev/null || true
    fi
    docker rm -fv "$collation_container" "$early_container" >/dev/null 2>&1 || true
    docker volume rm -f "$collation_volume" >/dev/null 2>&1 || true
    rm -f "$restart_logs" "$collation_restart_logs" \
        "$early_restart_logs" "$early_init_file" "$client_log"
    rm -rf "$collation_tmp_dir"
}
trap cleanup EXIT HUP INT TERM

initialization_complete=false
for _ in $(seq 1 120); do
    if docker logs "$container" 2>&1 | grep -q 'PostgreSQL initialization complete'; then
        initialization_complete=true
        break
    fi
    sleep 0.5
done

if [ "$initialization_complete" != true ]; then
    echo "PostgreSQL did not complete initialization before the restart test" >&2
    docker logs "$container" >&2
    exit 1
fi

docker exec -e PGAPPNAME=shutdown-regression-test "$container" \
    psql -U postgres -d local -c 'SELECT pg_sleep(60)' > "$client_log" 2>&1 &
client_pid=$!

client_connected=false
for _ in $(seq 1 120); do
    active_connections=$(docker exec "$container" psql -qAt -U postgres -d local \
        -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'shutdown-regression-test' AND state = 'active';")
    if [ "$active_connections" = 1 ]; then
        client_connected=true
        break
    fi
    sleep 0.5
done

if [ "$client_connected" != true ]; then
    echo "The test client did not establish an active PostgreSQL connection" >&2
    cat "$client_log" >&2
    exit 1
fi

initial_log_lines=$(docker logs "$container" 2>&1 | wc -l | tr -d '[:space:]')
log_start=$((initial_log_lines + 1))

docker restart --timeout 10 "$container" > /dev/null
wait "$client_pid" 2> /dev/null || true
client_pid=

postgres_ready=false
for _ in $(seq 1 120); do
    if docker exec "$container" pg_isready -q &&
        docker logs "$container" 2>&1 |
        tail -n "+$log_start" |
            grep -q 'PostgreSQL initialization complete'; then
        postgres_ready=true
        break
    fi
    sleep 0.5
done

docker logs "$container" 2>&1 | tail -n "+$log_start" > "$restart_logs"

if [ "$postgres_ready" != true ]; then
    echo "PostgreSQL did not become ready after restarting the container" >&2
    cat "$restart_logs" >&2
    exit 1
fi

if grep -Eq 'database system was interrupted|automatic recovery in progress' "$restart_logs"; then
    echo "PostgreSQL performed crash recovery after the container restart" >&2
    cat "$restart_logs" >&2
    exit 1
fi

if ! grep -q 'database system was shut down at' "$restart_logs"; then
    echo "PostgreSQL did not report a clean previous shutdown" >&2
    cat "$restart_logs" >&2
    exit 1
fi

echo "PostgreSQL restarted without crash recovery"

image=$(docker inspect --format '{{.Config.Image}}' "$container")

docker volume create "$collation_volume" >/dev/null
docker create --name "$collation_container" \
    --env PGAPPNAME=collation-repair-shutdown-test \
    --volume "$collation_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint /nhost-init.sh \
    "$image" >/dev/null
docker cp "$init_script" "$collation_container:/nhost-init.sh"
docker cp "$repair_script" "$collation_container:/bin/repair-collation.sh"
docker start "$collation_container" >/dev/null

collation_initialized=false
for _ in $(seq 1 120); do
    if docker exec "$collation_container" pg_isready -q 2>/dev/null &&
        docker logs "$collation_container" 2>&1 |
        grep -q 'PostgreSQL initialization complete'; then
        collation_initialized=true
        break
    fi
    sleep 0.5
done

if [ "$collation_initialized" != true ]; then
    echo "PostgreSQL did not initialize before the collation repair shutdown test" >&2
    docker logs "$collation_container" >&2
    exit 1
fi

# The expression index sleeps only during the first repair. Its sequence is
# advanced before the sleep and survives the clean stop, so the final restart
# can finish the still-pending repair without another delay.
docker exec -i -e PGAPPNAME=collation-repair-shutdown-setup \
    "$collation_container" psql -X -q -b -U postgres -d local \
    -v ON_ERROR_STOP=1 <<'SQL'
CREATE SEQUENCE collation_repair_shutdown_sequence;
CREATE FUNCTION slow_collation_repair_index(integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF current_setting('application_name') = 'collation-repair-shutdown-test' THEN
        IF nextval('public.collation_repair_shutdown_sequence'::regclass) = 1 THEN
            PERFORM pg_sleep(60);
        END IF;
    END IF;
    RETURN $1;
END;
$$;
CREATE TABLE collation_repair_shutdown_test (value integer NOT NULL);
INSERT INTO collation_repair_shutdown_test VALUES (1);
CREATE INDEX collation_repair_shutdown_test_idx
    ON collation_repair_shutdown_test (slow_collation_repair_index(value));
UPDATE pg_database
SET datcollversion = '0-test-stale'
WHERE datname = current_database();
SQL

docker stop --timeout 10 "$collation_container" >/dev/null
collation_log_lines=$(docker logs "$collation_container" 2>&1 | wc -l | tr -d '[:space:]')
collation_log_start=$((collation_log_lines + 1))
docker start "$collation_container" >/dev/null

collation_repair_active=false
for _ in $(seq 1 120); do
    if docker exec -e PGAPPNAME=collation-repair-shutdown-probe \
        "$collation_container" psql -qAt -U postgres -d local \
        -c "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'collation-repair-shutdown-test' AND state = 'active' AND query LIKE 'REINDEX DATABASE%' AND (SELECT is_called FROM collation_repair_shutdown_sequence);" 2>/dev/null |
        grep -qx 1; then
        collation_repair_active=true
        break
    fi
    sleep 0.5
done

if [ "$collation_repair_active" != true ]; then
    echo "The delayed collation repair did not start before the shutdown test" >&2
    docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" >&2
    exit 1
fi

if docker logs "$collation_container" 2>&1 |
    tail -n "+$collation_log_start" |
    grep -q 'PostgreSQL initialization complete'; then
    echo "PostgreSQL completed startup before the collation repair shutdown test" >&2
    docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" >&2
    exit 1
fi

if ! docker exec "$collation_container" /bin/sh -c '
set -- /tmp/postgresql/collation-databases.*
[ -f "$1" ]'; then
    echo "The active collation repair did not create its temporary database list" >&2
    docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" >&2
    exit 1
fi

docker stop --timeout 10 "$collation_container" >/dev/null
collation_exit_code=$(docker inspect --format '{{.State.ExitCode}}' \
    "$collation_container")
if [ "$collation_exit_code" != 0 ]; then
    echo "PostgreSQL exited with code $collation_exit_code during collation repair" >&2
    docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" >&2
    exit 1
fi

docker cp "$collation_container:/tmp/postgresql/." \
    "$collation_tmp_dir"
if find "$collation_tmp_dir" -maxdepth 1 -type f \
    -name 'collation-databases.*' -print -quit | grep -q .; then
    echo "Collation repair left its temporary database list after shutdown" >&2
    find "$collation_tmp_dir" -maxdepth 1 -type f \
        -name 'collation-databases.*' -print >&2
    exit 1
fi

collation_control_data=$(docker run --rm \
    --volume "$collation_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint pg_controldata \
    "$image" /var/lib/postgresql/data/pgdata)
collation_control_state=$(printf '%s\n' "$collation_control_data" |
    sed -n 's/^Database cluster state:[[:space:]]*//p')
if [ "$collation_control_state" != "shut down" ]; then
    echo "Expected the cluster interrupted during collation repair to be shut down, got ${collation_control_state:-no control state}" >&2
    printf '%s\n' "$collation_control_data" >&2
    docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" >&2
    exit 1
fi

collation_log_lines=$(docker logs "$collation_container" 2>&1 | wc -l | tr -d '[:space:]')
collation_log_start=$((collation_log_lines + 1))
docker start "$collation_container" >/dev/null

collation_restart_ready=false
for _ in $(seq 1 120); do
    if docker exec "$collation_container" pg_isready -q 2>/dev/null &&
        docker logs "$collation_container" 2>&1 |
        tail -n "+$collation_log_start" |
            grep -q 'PostgreSQL initialization complete'; then
        collation_restart_ready=true
        break
    fi
    sleep 0.5
done

docker logs "$collation_container" 2>&1 |
    tail -n "+$collation_log_start" >"$collation_restart_logs"

if [ "$collation_restart_ready" != true ]; then
    echo "PostgreSQL did not restart after shutdown during collation repair" >&2
    cat "$collation_restart_logs" >&2
    exit 1
fi

if grep -Eq 'database system was interrupted|automatic recovery in progress' \
    "$collation_restart_logs"; then
    echo "PostgreSQL performed crash recovery after shutdown during collation repair" >&2
    cat "$collation_restart_logs" >&2
    exit 1
fi

if ! grep -q 'database system was shut down at' "$collation_restart_logs"; then
    echo "PostgreSQL did not report a clean shutdown during collation repair" >&2
    cat "$collation_restart_logs" >&2
    exit 1
fi

echo "PostgreSQL stopped cleanly during collation repair and restarted without crash recovery"

printf '%s\n' \
    'CREATE TABLE early_shutdown_test_ready (ready boolean);' \
    'SELECT pg_sleep(60);' > "$early_init_file"
chmod 644 "$early_init_file"

# Docker Desktop may not share host temporary directories with its VM, so copy
# the delay script into the stopped container instead of bind-mounting it.
docker create --name "$early_container" \
    --volume /var/lib/postgresql \
    "$image" > /dev/null
docker cp "$early_init_file" "$early_container:/initdb.d/0001-delay.sql"
docker start "$early_container" > /dev/null

early_postgres_ready=false
for _ in $(seq 1 120); do
    if docker exec "$early_container" pg_isready -q 2> /dev/null; then
        early_postgres_ready=true
        break
    fi
    sleep 0.5
done

if [ "$early_postgres_ready" != true ]; then
    echo "PostgreSQL did not become ready for the early shutdown test" >&2
    docker logs "$early_container" >&2
    exit 1
fi

early_init_script_started=false
for _ in $(seq 1 120); do
    if docker exec "$early_container" \
        psql -qAt -U postgres -d local \
        -c "SELECT to_regclass('public.early_shutdown_test_ready') IS NOT NULL;" 2> /dev/null |
        grep -qx t; then
        early_init_script_started=true
        break
    fi
    sleep 0.5
done

if [ "$early_init_script_started" != true ]; then
    echo "The delayed init script did not start before the early shutdown test" >&2
    docker logs "$early_container" >&2
    exit 1
fi

if docker logs "$early_container" 2>&1 | grep -q 'PostgreSQL initialization complete'; then
    echo "PostgreSQL completed initialization before the early shutdown test" >&2
    docker logs "$early_container" >&2
    exit 1
fi

docker stop --timeout 10 "$early_container" > /dev/null
early_exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$early_container")

if [ "$early_exit_code" != 0 ]; then
    echo "PostgreSQL exited with code $early_exit_code during early shutdown" >&2
    docker logs "$early_container" >&2
    exit 1
fi

early_log_lines=$(docker logs "$early_container" 2>&1 | wc -l | tr -d '[:space:]')
early_log_start=$((early_log_lines + 1))
docker start "$early_container" > /dev/null

early_postgres_ready=false
for _ in $(seq 1 120); do
    if docker exec "$early_container" pg_isready -q 2> /dev/null &&
        docker logs "$early_container" 2>&1 |
        tail -n "+$early_log_start" |
            grep -q 'PostgreSQL initialization complete'; then
        early_postgres_ready=true
        break
    fi
    sleep 0.5
done

docker logs "$early_container" 2>&1 | tail -n "+$early_log_start" > "$early_restart_logs"

if [ "$early_postgres_ready" != true ]; then
    echo "PostgreSQL did not become ready after the early shutdown test" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

if grep -Eq 'database system was interrupted|database system was not properly shut down|automatic recovery in progress' "$early_restart_logs"; then
    echo "PostgreSQL performed crash recovery after the early shutdown" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

if ! grep -q 'database system was shut down at' "$early_restart_logs"; then
    echo "PostgreSQL did not report a clean early shutdown" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

echo "PostgreSQL stopped during initialization without crash recovery"
