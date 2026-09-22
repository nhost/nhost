#!/bin/sh

set -eu

init_script=${1:?"usage: $0 <init-script>"}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitr-promotion-test.XXXXXX")
server_pid=

cleanup() {
	trap - EXIT HUP INT TERM
	if [ -n "$server_pid" ]; then
		kill "$server_pid" 2>/dev/null || true
		wait "$server_pid" 2>/dev/null || true
	fi
	rm -rf "$test_dir"
}
trap cleanup EXIT
trap 'cleanup; exit 1' HUP INT TERM

# Load the entrypoint functions without invoking main.
sed '$ { /^main$/d; }' "$init_script" >"$test_dir/init-functions.sh"
# The generated file contains the entrypoint functions.
# shellcheck disable=SC1091
. "$test_dir/init-functions.sh"

mkdir "$test_dir/bin"
cat >"$test_dir/bin/psql" <<'EOF'
#!/bin/sh

set -eu

sql=
while [ "$#" -gt 0 ]; do
	case $1 in
	-c)
		sql=$2
		shift 2
		;;
	*)
		shift
		;;
	esac
done

case $sql in
'SELECT pg_is_in_recovery();')
	# A successful query returning true models hot-standby readiness before promotion.
	if [ ! -f "$RECOVERY_ATTEMPT" ]; then
		: >"$RECOVERY_ATTEMPT"
		printf '%s\n' recovery >>"$PSQL_TRACE"
		printf '%s\n' t
	else
		printf '%s\n' promoted >>"$PSQL_TRACE"
		printf '%s\n' f
	fi
	;;
'SELECT mark_restored();')
	printf '%s\n' post-restore >>"$PSQL_TRACE"
	;;
*)
	echo "unexpected SQL: $sql" >&2
	exit 1
	;;
esac
EOF
cat >"$test_dir/bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod +x "$test_dir/bin/psql" "$test_dir/bin/sleep"

real_sleep=$(command -v sleep)
"$real_sleep" 60 &
server_pid=$!

export PSQL_TRACE="$test_dir/psql-trace"
export RECOVERY_ATTEMPT="$test_dir/recovery-attempt"
PATH="$test_dir/bin:$PATH"
export PATH
export POSTGRES_PID="$server_pid"
export POSTGRES_DB=local
export PITR_POST_RESTORE_SQL='SELECT mark_restored();'

wait_for_postgres_promotion
post_restore_sql

cat >"$test_dir/expected-trace" <<'EOF'
recovery
promoted
post-restore
EOF

diff -u "$test_dir/expected-trace" "$PSQL_TRACE"
