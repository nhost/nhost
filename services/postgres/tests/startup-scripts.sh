#!/bin/sh

set -eu

init_script=${1:?"usage: $0 <init-script>"}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/startup-scripts-test.XXXXXX")

cleanup() {
	trap - EXIT HUP INT TERM
	if [ -n "${POSTGRES_PID:-}" ]; then
		kill "$POSTGRES_PID" 2>/dev/null || true
		wait "$POSTGRES_PID" 2>/dev/null || true
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

file=
on_error_stop=false
while [ "$#" -gt 0 ]; do
	case $1 in
	-f)
		file=$2
		shift 2
		;;
	-v)
		if [ "$2" = ON_ERROR_STOP=1 ]; then
			on_error_stop=true
		fi
		shift 2
		;;
	*)
		shift
		;;
	esac
done

if [ -z "$file" ]; then
	echo "psql was not given a SQL file" >&2
	exit 1
fi

while IFS= read -r statement || [ -n "$statement" ]; do
	case $statement in
	*forced_sql_error*)
		echo "forced SQL error" >&2
		if [ "$on_error_stop" = true ]; then
			exit 3
		fi
		;;
	*)
		printf '%s\n' "$statement" >>"$PSQL_STATEMENTS_TRACE"
		;;
	esac
done <"$file"
EOF
chmod +x "$test_dir/bin/psql"

cat >"$test_dir/failing.sql" <<'EOF'
SELECT before_error;
SELECT forced_sql_error;
SELECT after_error;
EOF
cat >"$test_dir/next.sql" <<'EOF'
SELECT next_file;
EOF

PATH="$test_dir/bin:$PATH"
export PATH
export PGDATA="$test_dir/pgdata"
export POSTGRES_DB=local
export SERVER_AVAILABLE_TRACE="$test_dir/server-available"
export SERVER_STOP="$test_dir/server-stop"
export PSQL_STATEMENTS_TRACE="$test_dir/statements"
mkdir -p "$PGDATA"

helper_status=0
run_psql_file "$POSTGRES_DB" "$test_dir/failing.sql" \
	>"$test_dir/helper-stdout" 2>"$test_dir/helper-stderr" || helper_status=$?
if [ "$helper_status" -eq 0 ]; then
	echo "run_psql_file did not report the SQL error" >&2
	exit 1
fi
if grep -Fq 'SELECT after_error;' "$PSQL_STATEMENTS_TRACE"; then
	echo "recurring SQL continued past the error" >&2
	exit 1
fi
: >"$PSQL_STATEMENTS_TRACE"

# Exercise the startup guards with a live stand-in for PostgreSQL. First-boot
# SQL continues within and after the failing file; recurring SQL fails fast.
# The Nhost step still observes an available server before the stand-in exits.
init_db() {
	DATABASE_INITIALIZED=true
	export DATABASE_INITIALIZED
}

resolve_config() {
	:
}

start_postgres() {
	attempt=0
	while [ ! -f "$SERVER_STOP" ] && [ "$attempt" -lt 500 ]; do
		sleep 0.01
		attempt=$((attempt + 1))
	done
}

wait_for_postgres() {
	kill -0 "$POSTGRES_PID"
}

run_init_scripts() {
	run_psql_file "$POSTGRES_DB" "$test_dir/failing.sql" continue_on_sql_error &&
		run_psql_file "$POSTGRES_DB" "$test_dir/next.sql" continue_on_sql_error
}

run_nhost_scripts() {
	kill -0 "$POSTGRES_PID"
	: >"$SERVER_AVAILABLE_TRACE"
	: >"$SERVER_STOP"
	run_psql_file "$POSTGRES_DB" "$test_dir/failing.sql"
}

delete_core_dumps() {
	:
}

(main) >"$test_dir/main-stdout" 2>"$test_dir/main-stderr"

if grep -Fq 'Initialization script execution failed' "$test_dir/main-stderr"; then
	echo "first-boot SQL error unexpectedly aborted initialization" >&2
	exit 1
fi
grep -Fq 'forced SQL error' "$test_dir/main-stderr"
grep -Fq 'Nhost script execution failed; continuing PostgreSQL startup' \
	"$test_dir/main-stderr"
grep -Fq 'SELECT after_error;' "$PSQL_STATEMENTS_TRACE"
grep -Fq 'SELECT next_file;' "$PSQL_STATEMENTS_TRACE"
if [ "$(grep -Fc 'SELECT after_error;' "$PSQL_STATEMENTS_TRACE")" -ne 1 ]; then
	echo "recurring SQL did not stop at the error" >&2
	exit 1
fi
if [ ! -f "$SERVER_AVAILABLE_TRACE" ]; then
	echo "startup did not continue with PostgreSQL available" >&2
	exit 1
fi
