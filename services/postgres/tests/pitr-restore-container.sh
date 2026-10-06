#!/bin/sh

set -eu

running_container=${1:-postgres-tests}
script_dir=$(cd "$(dirname "$0")" && pwd)
init_script="$script_dir/../postgres/bin/init.sh"
image=$(docker inspect --format '{{.Config.Image}}' "$running_container")
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitr-container-test.XXXXXX")
test_container="postgres-pitr-preflight-$$"
interrupt_container="postgres-pitr-interrupt-$$"

cleanup() {
	docker rm -fv "$test_container" "$interrupt_container" >/dev/null 2>&1 || true
	rm -rf "$test_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

mkdir "$test_dir/test-bin" "$test_dir/temp"
cat >"$test_dir/test-bin/wal-g" <<'EOF'
#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ "$1" != backup-list ]; then
	echo "unexpected wal-g command" >&2
	exit 1
fi
# Stdout is parsed as the backup list; send the test marker to stderr.
echo 'pitr-preflight-test: backup-list called' >&2
# An empty list forces preflight to stop before removing the existing PGDATA.
echo 'backup_name modified wal_file_name storage_name'
EOF
chmod 755 "$test_dir/test-bin/wal-g"
printf 'original cluster\n' >"$test_dir/original"

# Copy the checked-out entrypoint into the stopped image: /bin/init.sh is a
# Nix-store symlink, so it cannot be overwritten in place. Do not change the
# image's default postgres user or mount the host's writable /tmp into it.
docker create --name "$test_container" \
	--env PITR_BASEBACKUP=LATEST \
	--env PATH=/tmp/postgresql/test-bin:/bin:/usr/bin \
	--entrypoint /tmp/postgresql/init.sh \
	"$image" >/dev/null
if [ "$(docker inspect --format '{{.Config.User}}' "$test_container")" != postgres ]; then
	echo 'PITR test container is not running as postgres' >&2
	exit 1
fi
docker cp "$init_script" "$test_container:/tmp/postgresql/init.sh"
docker cp "$test_dir/test-bin" "$test_container:/tmp/postgresql/test-bin"
docker cp "$test_dir/original" \
	"$test_container:/var/lib/postgresql/data/pgdata/original"

docker start -a "$test_container" >"$test_dir/log" 2>&1 || true
status=$(docker inspect --format '{{.State.ExitCode}}' "$test_container")
if [ "$status" != 1 ] ||
	! grep -Fq 'pitr-preflight-test: backup-list called' "$test_dir/log" ||
	! grep -Fq 'preflight failed: backup selector LATEST is not available' "$test_dir/log"; then
	echo "PITR preflight did not reach the controlled backup-list (exit $status)" >&2
	cat "$test_dir/log" >&2
	exit 1
fi

docker cp "$test_container:/var/lib/postgresql/data/pgdata/original" \
	"$test_dir/copied-original"
cmp "$test_dir/original" "$test_dir/copied-original"
docker cp "$test_container:/tmp/postgresql/." "$test_dir/temp"
if find "$test_dir/temp" -maxdepth 1 -name 'pitr-backup-list.*' -print -quit |
	grep -q .; then
	echo 'PITR preflight left its temporary backup list behind' >&2
	exit 1
fi

echo 'PITR preflight reached WAL-G as postgres and preserved PGDATA'

# A successful preflight followed by an interrupted backup-fetch must not be
# reported as a completed one-shot restore.
cat >"$test_dir/test-bin/wal-g" <<'EOF'
#!/bin/sh
set -eu

case ${1:-} in
backup-list)
	printf '%s\n' 'backup_name modified wal_file_name storage_name' \
		'base_available 2026-01-01T00:00:00Z 000000010000000000000001 default'
	;;
backup-fetch)
	mkdir -p "$2"
	: >"$2/partial-restore"
	echo 'pitr-interrupt-test: backup-fetch blocked' >&2
	while :; do sleep 1; done
	;;
*)
	echo "unexpected wal-g command: $*" >&2
	exit 1
	;;
esac
EOF

docker create --name "$interrupt_container" \
	--env PITR_BASEBACKUP=LATEST \
	--env PATH=/tmp/postgresql/test-bin:/bin:/usr/bin \
	--entrypoint /tmp/postgresql/init.sh \
	"$image" >/dev/null
docker cp "$init_script" "$interrupt_container:/tmp/postgresql/init.sh"
docker cp "$test_dir/test-bin" "$interrupt_container:/tmp/postgresql/test-bin"
docker start "$interrupt_container" >/dev/null

fetch_blocked=false
for _ in $(seq 1 100); do
	if docker logs "$interrupt_container" 2>&1 |
		grep -Fq 'pitr-interrupt-test: backup-fetch blocked'; then
		fetch_blocked=true
		break
	fi
	if [ "$(docker inspect --format '{{.State.Running}}' "$interrupt_container")" != true ]; then
		break
	fi
	sleep 0.1
done
if [ "$fetch_blocked" != true ]; then
	echo 'PITR container did not reach backup-fetch' >&2
	docker logs "$interrupt_container" >&2
	exit 1
fi

docker stop --timeout 10 "$interrupt_container" >/dev/null
status=$(docker inspect --format '{{.State.ExitCode}}' "$interrupt_container")
if [ "$status" != 143 ] ||
	! docker logs "$interrupt_container" 2>&1 |
	grep -Fq 'Received shutdown signal, shutting down PostgreSQL'; then
	echo "PITR interrupted backup-fetch returned $status instead of 143" >&2
	docker logs "$interrupt_container" >&2
	exit 1
fi
echo 'PITR interrupted backup-fetch exited non-zero after clean shutdown'
