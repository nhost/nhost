#!/bin/sh

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
init_script="$script_dir/../postgres/bin/init.sh"
image=${1:-$(docker inspect --format '{{.Config.Image}}' postgres-tests)}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitr-restart-test.XXXXXX")
source_container="postgres-pitr-restart-source-$$"
restore_container="postgres-pitr-restart-restore-$$"
normal_container="postgres-pitr-restart-normal-$$"
volume="postgres-pitr-restart-$$"

cleanup() {
	docker rm -fv "$normal_container" "$restore_container" "$source_container" >/dev/null 2>&1 || true
	docker volume rm "$volume" >/dev/null 2>&1 || true
	rm -rf "$test_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

fail() {
	echo "$1" >&2
	for container in "$source_container" "$restore_container" "$normal_container"; do
		docker logs "$container" >&2 2>/dev/null || true
	done
	exit 1
}

wait_for_sql() {
	container=$1
	attempt=0
	while [ "$attempt" -lt 60 ]; do
		if docker exec "$container" psql -X -q -A -t -U postgres -d local \
			-c 'SELECT 1;' >/dev/null 2>&1; then
			return 0
		fi
		sleep 1
		attempt=$((attempt + 1))
	done
	return 1
}

# Check the actual image default, not an environment override on the test job.
if ! docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$image" |
	grep -Fxq 'PITR_TARGET_ACTION=promote'; then
	fail "image $image does not default PITR_TARGET_ACTION to promote"
fi

docker run -d --name "$source_container" "$image" >/dev/null
wait_for_sql "$source_container" || fail 'source PostgreSQL did not start'
docker exec "$source_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d local \
	-c 'CREATE TABLE public.pitr_restart_rows (id integer PRIMARY KEY); INSERT INTO public.pitr_restart_rows VALUES (42);' \
	>/dev/null

# Back up a committed row, then delete it in later WAL. Capture the target
# between these operations, not within the time the base backup is running.
docker exec "$source_container" pg_basebackup -U postgres \
	-D /tmp/postgresql/pitr-basebackup -X stream --checkpoint=fast
target=$(docker exec "$source_container" psql -X -q -A -t -U postgres -d local \
	-c "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00';")
docker exec "$source_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d local \
	-c 'DELETE FROM public.pitr_restart_rows; SELECT pg_switch_wal();' >/dev/null
[ "$(docker exec "$source_container" psql -X -q -A -t -U postgres -d local \
	-c 'SELECT count(*) FROM public.pitr_restart_rows;')" = 0 ] || fail 'source row was not deleted'

mkdir -p "$test_dir/fixtures/basebackup" "$test_dir/fixtures/wal" "$test_dir/test-bin"
docker cp "$source_container:/tmp/postgresql/pitr-basebackup/." "$test_dir/fixtures/basebackup/"
docker cp "$source_container:/var/lib/postgresql/data/pgdata/pg_wal/." "$test_dir/fixtures/wal/"
# docker cp to a container creates root-owned files. The postgres user must be
# able to read the copied fixtures before copying them into its own PGDATA.
chmod -R a+rX "$test_dir/fixtures"
docker stop "$source_container" >/dev/null

cat >"$test_dir/test-bin/wal-g" <<'EOF'
#!/bin/sh
set -eu
case ${1:-} in
backup-list)
	printf '%s\n' 'backup_name modified wal_file_name storage_name' \
		'base_fixture 2026-01-01T00:00:00Z 000000010000000000000001 default'
	;;
backup-fetch)
	[ "$#" -eq 3 ] && [ "$3" = base_fixture ] || exit 1
	mkdir -p "$2"
	cp -R /tmp/postgresql/fixtures/basebackup/. "$2/"
	chmod 700 "$2"
	;;
wal-fetch)
	[ "$#" -eq 3 ] || exit 1
	[ -f "/tmp/postgresql/fixtures/wal/$2" ] || exit 74
	cp "/tmp/postgresql/fixtures/wal/$2" "$3"
	;;
*) exit 1 ;;
esac
EOF
chmod 755 "$test_dir/test-bin/wal-g"

# A named volume preserves PGDATA across the restore container's exit and the
# subsequent normal start. Let postgres replace PGDATA inside that volume.
docker volume create "$volume" >/dev/null
docker run --rm --user root -v "$volume:/var/lib/postgresql/data" \
	--entrypoint /bin/sh "$image" \
	-c 'chown postgres:postgres /var/lib/postgresql/data' >/dev/null
docker create --name "$restore_container" -v "$volume:/var/lib/postgresql/data" \
	--env PITR_BASEBACKUP=base_fixture --env "PITR_RECOVERY_TARGET=$target" \
	--env PATH=/tmp/postgresql/test-bin:/bin:/usr/bin \
	--entrypoint /tmp/postgresql/init.sh "$image" >/dev/null
docker cp "$init_script" "$restore_container:/tmp/postgresql/init.sh"
docker cp "$test_dir/fixtures" "$restore_container:/tmp/postgresql/fixtures"
docker cp "$test_dir/test-bin" "$restore_container:/tmp/postgresql/test-bin"
# Ensure the target is in the past even when the source ran within one second.
sleep 2
docker start "$restore_container" >/dev/null
echo "PITR restore container started: $restore_container"
attempt=0
while [ "$(docker inspect --format '{{.State.Running}}' "$restore_container")" = true ] &&
	[ "$attempt" -lt 120 ]; do
	sleep 1
	attempt=$((attempt + 1))
done
[ "$attempt" -lt 120 ] || fail 'PITR restore did not finish'
[ "$(docker inspect --format '{{.State.ExitCode}}' "$restore_container")" = 0 ] ||
	fail 'PITR restore exited unsuccessfully'
docker logs "$restore_container" >"$test_dir/restore.log" 2>&1
grep -Fq 'Waiting for postgres to finish recovery and promote' "$test_dir/restore.log" ||
	fail 'PITR restore did not wait for promotion'
docker cp "$restore_container:/var/lib/postgresql/data/pgdata/postgresql.auto.conf" \
	"$test_dir/recovery.conf"
grep -Fq "recovery_target_action = 'promote'" "$test_dir/recovery.conf" ||
	fail 'PITR restore did not configure promotion'

# Reuse the restored volume without PITR flags, as the orchestrator does.
docker create --name "$normal_container" -v "$volume:/var/lib/postgresql/data" \
	--entrypoint /tmp/postgresql/init.sh "$image" >/dev/null
docker cp "$init_script" "$normal_container:/tmp/postgresql/init.sh"
docker start "$normal_container" >/dev/null
wait_for_sql "$normal_container" || fail 'normal PostgreSQL did not start'
rows=$(docker exec "$normal_container" psql -X -q -A -t -U postgres -d local \
	-c 'SELECT count(*) FROM public.pitr_restart_rows WHERE id = 42;')
[ "$rows" = 1 ] || fail "row deleted after the recovery target was not restored (count: $rows)"

echo 'PITR promotion retained the pre-delete row across normal restart'
