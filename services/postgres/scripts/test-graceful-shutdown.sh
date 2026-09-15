#!/bin/sh

set -eu

container=${1:-postgres-tests}
restart_logs=$(mktemp)
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
    docker rm -fv "$early_container" > /dev/null 2>&1 || true
    rm -f "$restart_logs" "$early_restart_logs" "$early_init_file" "$client_log"
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
