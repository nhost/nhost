#!/bin/sh

set -eu

init_script=${1:?"usage: $0 <init-script>"}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/pitr-promotion-test.XXXXXX")
server_pid=
main_pid=

cleanup() {
	trap - EXIT HUP INT TERM
	if [ -n "$server_pid" ]; then
		kill "$server_pid" 2>/dev/null || true
		wait "$server_pid" 2>/dev/null || true
	fi
	if [ -n "$main_pid" ]; then
		kill "$main_pid" 2>/dev/null || true
		wait "$main_pid" 2>/dev/null || true
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
'SELECT block_post_restore();')
	printf '%s\n' post-restore-blocking >>"$PSQL_TRACE"
	: >"$PSQL_BLOCKED"
	while :; do
		"$REAL_SLEEP" 0.1
	done
	;;
'SELECT fail_without_database();')
	printf '%s\n' post-restore-no-db >>"$PSQL_TRACE"
	exit 3
	;;
'SELECT fail_with_database();')
	printf '%s\n' post-restore-db >>"$PSQL_TRACE"
	exit 3
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
export REAL_SLEEP="$real_sleep"
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

kill "$server_pid"
wait "$server_pid" 2>/dev/null || true
server_pid=

cat >"$test_dir/bin/pg_ctl" <<'EOF'
#!/bin/sh

set -eu

if [ "$#" -eq 1 ] && [ "$1" = stop ]; then
	printf '%s\n' stop-requested >>"$PSQL_TRACE"
elif [ "$#" -eq 4 ] && [ "$1" = stop ] &&
	[ "$2" = "--pgdata=$PGDATA" ] && [ "$3" = --mode=fast ] &&
	[ "$4" = --wait ]; then
	printf '%s\n' fast-stop-requested >>"$PSQL_TRACE"
else
	echo "unexpected pg_ctl arguments: $*" >&2
	exit 1
fi
: >"$SERVER_STOP"
# Model pg_ctl --wait: the server must have finished stopping before return.
while [ -f "$PGDATA/postmaster.pid" ]; do
	"$REAL_SLEEP" 0.01
done
EOF
chmod +x "$test_dir/bin/pg_ctl"

resolve_config() {
	:
}

pitr_restore() {
	:
}

start_postgres() {
	: >"$PGDATA/postmaster.pid"
	while [ ! -f "$SERVER_STOP" ]; do
		"$real_sleep" 0.01
	done
	printf '%s\n' server-stopped >>"$PSQL_TRACE"
	rm -f "$PGDATA/postmaster.pid"
}

wait_for_postgres_promotion() {
	kill -0 "$POSTGRES_PID"
}

: >"$PSQL_TRACE"
export SERVER_STOP="$test_dir/server-stop"
export PGDATA="$test_dir/pgdata"
mkdir -p "$PGDATA"
export PITR_BASEBACKUP=LATEST
export PITR_TARGET_ACTION=promote
export PITR_POST_RESTORE_SQL_NO_DB='SELECT fail_without_database();'
export PITR_POST_RESTORE_SQL='SELECT fail_with_database();'

promotion_status=0
(main) >"$test_dir/promotion-stdout" 2>"$test_dir/promotion-stderr" ||
	promotion_status=$?
if [ "$promotion_status" -eq 0 ]; then
	echo "PITR promotion succeeded after post-restore SQL failures" >&2
	exit 1
fi

grep -Fq \
	"Post-restore SQL without a database connection failed" \
	"$test_dir/promotion-stderr"
grep -Fq \
	"Post-restore SQL with a database connection failed" \
	"$test_dir/promotion-stderr"

cat >"$test_dir/expected-trace" <<'EOF'
post-restore-no-db
post-restore-db
stop-requested
server-stopped
EOF

diff -u "$test_dir/expected-trace" "$PSQL_TRACE"

# TERM during post-restore SQL must stop the server without reporting success.
rm -f "$SERVER_STOP"
: >"$PSQL_TRACE"
export PSQL_BLOCKED="$test_dir/psql-blocked"
unset PITR_POST_RESTORE_SQL_NO_DB
export PITR_POST_RESTORE_SQL='SELECT block_post_restore();'
(main) >"$test_dir/interrupt-stdout" 2>"$test_dir/interrupt-stderr" &
main_pid=$!
blocked=false
for _ in $(seq 1 100); do
	if [ -f "$PSQL_BLOCKED" ]; then
		blocked=true
		break
	fi
	if ! kill -0 "$main_pid" 2>/dev/null; then
		break
	fi
	"$real_sleep" 0.05
done
if [ "$blocked" != true ]; then
	echo "PITR did not reach blocking post-restore SQL" >&2
	cat "$test_dir/interrupt-stderr" >&2
	exit 1
fi

kill -TERM "$main_pid"
promotion_status=0
wait "$main_pid" || promotion_status=$?
main_pid=
if [ "$promotion_status" -ne 143 ]; then
	echo "TERM during PITR returned $promotion_status instead of 143" >&2
	cat "$test_dir/interrupt-stderr" >&2
	exit 1
fi
cat >"$test_dir/expected-trace" <<'EOF'
post-restore-blocking
fast-stop-requested
server-stopped
EOF
diff -u "$test_dir/expected-trace" "$PSQL_TRACE"
