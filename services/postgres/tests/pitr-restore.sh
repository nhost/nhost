#!/bin/sh

set -eu

init_script=${1:?"usage: $0 <init-script>"}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitr-restore-test.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM

# Load the entrypoint functions without invoking main.
sed '$ { /^main$/d; }' "$init_script" >"$test_dir/init-functions.sh"
# The generated file contains the entrypoint functions.
# shellcheck disable=SC1091
. "$test_dir/init-functions.sh"

mkdir "$test_dir/bin"
cat >"$test_dir/bin/wal-g" <<'EOF'
#!/bin/sh

set -eu

case ${1:-} in
backup-list)
	printf '%s\n' backup-list >>"$WALG_TRACE"
	if [ "${WALG_BACKUP_LIST_FAIL:-}" = 1 ]; then
		echo "backup storage unavailable" >&2
		exit 17
	fi
	cat "$WALG_BACKUP_LIST"
	;;
backup-fetch)
	if [ "$#" -ne 3 ]; then
		echo "unexpected backup-fetch arguments" >&2
		exit 1
	fi
	printf 'backup-fetch %s %s\n' "$2" "$3" >>"$WALG_TRACE"
	if [ "$2" != "$PGDATA" ]; then
		echo "backup-fetch did not target PGDATA directly" >&2
		exit 1
	fi
	if [ -e "$2" ]; then
		echo "PGDATA still existed when backup-fetch started" >&2
		exit 1
	fi
	mkdir -p "$2"
	if [ "${WALG_BACKUP_FETCH_FAIL:-}" = 1 ]; then
		: >"$2/partial-restore"
		exit 18
	fi
	: >"$2/restored"
	;;
*)
	echo "unexpected wal-g command: ${1:-}" >&2
	exit 1
	;;
esac
EOF
chmod +x "$test_dir/bin/wal-g"

export PATH="$test_dir/bin:$PATH"
export TMPDIR="$test_dir"
export PGDATA="$test_dir/pgdata"
export PITR_RECOVERY_TARGET='2026-01-02 03:04:05+00'
export PITR_TARGET_ACTION=shutdown
export PITR_TARGET_TIMELINE=latest
export WALG_BACKUP_LIST="$test_dir/backup-list"
export WALG_TRACE="$test_dir/wal-g-trace"

cat >"$WALG_BACKUP_LIST" <<'EOF'
backup_name modified wal_file_name storage_name
base_available 2026-01-01T00:00:00Z 000000010000000000000001 default
EOF

reset_pgdata() {
	rm -rf "$PGDATA"
	mkdir -p "$PGDATA"
	: >"$PGDATA/original"
	: >"$WALG_TRACE"
	unset WALG_BACKUP_LIST_FAIL WALG_BACKUP_FETCH_FAIL
}

expect_restore_failure() {
	failure_name=$1
	status=0
	pitr_restore >"$test_dir/$failure_name-stdout" \
		2>"$test_dir/$failure_name-stderr" || status=$?
	if [ "$status" -eq 0 ]; then
		echo "$failure_name unexpectedly succeeded" >&2
		exit 1
	fi
}

# Storage/configuration failures during the lightweight listing preflight must
# leave the existing cluster untouched and must not start backup-fetch.
reset_pgdata
export PITR_BASEBACKUP=LATEST
export WALG_BACKUP_LIST_FAIL=1
expect_restore_failure preflight-storage
[ -f "$PGDATA/original" ]
printf '%s\n' backup-list >"$test_dir/expected-trace"
diff -u "$test_dir/expected-trace" "$WALG_TRACE"

# An empty but successful listing does not make LATEST selectable.
reset_pgdata
: >"$WALG_BACKUP_LIST"
export PITR_BASEBACKUP=LATEST
expect_restore_failure preflight-latest
[ -f "$PGDATA/original" ]
printf '%s\n' backup-list >"$test_dir/expected-trace"
diff -u "$test_dir/expected-trace" "$WALG_TRACE"

# WAL-G 3.0.7 only treats LATEST as symbolic. Named selectors can therefore be
# checked exactly against backup-list before replacing the existing cluster.
reset_pgdata
cat >"$WALG_BACKUP_LIST" <<'EOF'
backup_name modified wal_file_name storage_name
base_available 2026-01-01T00:00:00Z 000000010000000000000001 default
EOF
export PITR_BASEBACKUP=base_missing
expect_restore_failure preflight-selector
[ -f "$PGDATA/original" ]
printf '%s\n' backup-list >"$test_dir/expected-trace"
diff -u "$test_dir/expected-trace" "$WALG_TRACE"

# A listed backup makes LATEST selectable, after which restore intentionally
# removes PGDATA and fetches the replacement directly into that path.
reset_pgdata
export PITR_BASEBACKUP=LATEST
pitr_restore
[ ! -e "$PGDATA/original" ]
[ -f "$PGDATA/restored" ]
[ -f "$PGDATA/recovery.signal" ]
grep -Fq "recovery_target_time = '$PITR_RECOVERY_TARGET'" \
	"$PGDATA/postgresql.auto.conf"
cat >"$test_dir/expected-trace" <<EOF
backup-list
backup-fetch $PGDATA LATEST
EOF
diff -u "$test_dir/expected-trace" "$WALG_TRACE"

# Preflight cannot make a direct restore atomic. A fetch failure after the
# successful listing is destructive and can leave a partial PGDATA.
reset_pgdata
export PITR_BASEBACKUP=base_available
export WALG_BACKUP_FETCH_FAIL=1
expect_restore_failure backup-fetch
[ ! -e "$PGDATA/original" ]
[ -f "$PGDATA/partial-restore" ]
cat >"$test_dir/expected-trace" <<EOF
backup-list
backup-fetch $PGDATA base_available
EOF
diff -u "$test_dir/expected-trace" "$WALG_TRACE"
