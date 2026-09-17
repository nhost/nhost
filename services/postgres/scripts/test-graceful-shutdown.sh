#!/bin/sh

set -eu

container=${1:-postgres-tests}
script_dir=$(dirname "$0")
script_dir=$(cd "$script_dir" >/dev/null && pwd)
init_script="$script_dir/../postgres/bin/init.sh"
restart_logs=$(mktemp)
early_restart_logs=$(mktemp)
early_init_file=$(mktemp)
early_container="postgres-early-shutdown-$$"
early_volume="postgres-early-shutdown-data-$$"
client_log=$(mktemp)
client_pid=

cleanup() {
    if [ -n "$client_pid" ] && kill -0 "$client_pid" 2>/dev/null; then
        kill "$client_pid" 2>/dev/null || true
        wait "$client_pid" 2>/dev/null || true
    fi
    docker rm -fv "$early_container" >/dev/null 2>&1 || true
    docker volume rm -f "$early_volume" >/dev/null 2>&1 || true
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
    psql -U postgres -d local -c 'SELECT pg_sleep(60)' >"$client_log" 2>&1 &
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

docker restart --timeout 10 "$container" >/dev/null
wait "$client_pid" 2>/dev/null || true
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

docker logs "$container" 2>&1 | tail -n "+$log_start" >"$restart_logs"

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
    'CREATE TABLE early_shutdown_test_started (started boolean);' \
    "SELECT pg_sleep(\${EARLY_SHUTDOWN_TEST_DELAY});" \
    'CREATE TABLE early_shutdown_test_finished (finished boolean);' >"$early_init_file"
chmod 644 "$early_init_file"

docker volume create "$early_volume" >/dev/null

# Docker Desktop may not share host temporary directories with its VM, so copy
# the delay script and current worktree entrypoint into the stopped container
# instead of bind-mounting them. This avoids testing a stale init.sh from the image.
docker create --name "$early_container" \
    --env EARLY_SHUTDOWN_TEST_DELAY=60 \
    --volume "$early_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint /nhost-init.sh \
    "$image" >/dev/null
docker cp "$init_script" "$early_container:/nhost-init.sh"
docker cp "$early_init_file" "$early_container:/initdb.d/0000-delay.sql"
docker start "$early_container" >/dev/null

early_postgres_ready=false
for _ in $(seq 1 120); do
    if docker exec "$early_container" pg_isready -q 2>/dev/null; then
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
        -c "SELECT to_regclass('public.early_shutdown_test_started') IS NOT NULL;" 2>/dev/null |
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

docker stop --timeout 10 "$early_container" >/dev/null
early_exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$early_container")

if [ "$early_exit_code" != 0 ]; then
    echo "PostgreSQL exited with code $early_exit_code during early shutdown" >&2
    docker logs "$early_container" >&2
    exit 1
fi

early_control_data=$(docker run --rm \
    --volume "$early_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint pg_controldata \
    "$image" /var/lib/postgresql/data/pgdata)
early_control_state=$(printf '%s\n' "$early_control_data" |
    sed -n 's/^Database cluster state:[[:space:]]*//p')
if [ "$early_control_state" != "shut down" ]; then
    echo "Expected the interrupted cluster to be shut down, got ${early_control_state:-no control state}" >&2
    printf '%s\n' "$early_control_data" >&2
    docker logs "$early_container" >&2
    exit 1
fi

early_anonymous_volume=$(docker inspect --format \
    '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' \
    "$early_container")
if [ -z "$early_anonymous_volume" ]; then
    echo "Expected the early shutdown container to have an anonymous PostgreSQL volume" >&2
    exit 1
fi

docker rm -v "$early_container" >/dev/null

if docker volume inspect "$early_anonymous_volume" >/dev/null 2>&1; then
    echo "The early shutdown container leaked its anonymous PostgreSQL volume" >&2
    exit 1
fi

if ! docker volume inspect "$early_volume" >/dev/null 2>&1; then
    echo "Removing the early shutdown container also removed its named PGDATA volume" >&2
    exit 1
fi

# A non-empty named volume retains this mode across remounts. The recreated
# container verifies the persisted mode before init.sh normalizes it.
docker run --rm \
    --volume "$early_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint /bin/chmod \
    "$image" 0755 /var/lib/postgresql/data/pgdata

docker create --name "$early_container" \
    --env EARLY_SHUTDOWN_TEST_DELAY=0 \
    --volume "$early_volume:/var/lib/postgresql/data/pgdata" \
    --entrypoint /bin/sh \
    "$image" -c 'pgdata_mode=$(stat -c "%a" "$PGDATA")
if [ "$pgdata_mode" != 755 ]; then
    echo "Expected PGDATA mode 755 before initialization, got $pgdata_mode" >&2
    exit 1
fi
exec /nhost-init.sh' >/dev/null
docker cp "$init_script" "$early_container:/nhost-init.sh"
docker cp "$early_init_file" "$early_container:/initdb.d/0000-delay.sql"
docker start "$early_container" >/dev/null

early_postgres_ready=false
for _ in $(seq 1 120); do
    if docker exec "$early_container" pg_isready -q 2>/dev/null &&
        docker logs "$early_container" 2>&1 |
        grep -q 'PostgreSQL initialization complete'; then
        early_postgres_ready=true
        break
    fi
    sleep 0.5
done

docker logs "$early_container" >"$early_restart_logs" 2>&1

if [ "$early_postgres_ready" != true ]; then
    echo "PostgreSQL did not become ready after the early shutdown test" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

normalized_pgdata_mode=$(docker exec "$early_container" \
    stat -c '%a' /var/lib/postgresql/data/pgdata)
if [ "$normalized_pgdata_mode" != 750 ]; then
    echo "Expected init.sh to normalize PGDATA mode to 750, got $normalized_pgdata_mode" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

if ! docker exec "$early_container" \
    psql -qAt -U postgres -d local \
    -c "SELECT to_regclass('public.early_shutdown_test_finished') IS NOT NULL;" |
    grep -qx t; then
    echo "PostgreSQL did not finish the interrupted init script after recreating the container" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

if ! docker exec "$early_container" \
    psql -qAt -U postgres -d local \
    -c "SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nhost_hasura');" |
    grep -qx t; then
    echo "PostgreSQL did not finish the normal schema initialization after recreating the container" >&2
    cat "$early_restart_logs" >&2
    exit 1
fi

echo "PostgreSQL stopped cleanly during initialization and completed initialization after restart"
