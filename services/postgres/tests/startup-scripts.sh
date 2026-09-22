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

if grep -Fq forced_sql_error "$file"; then
	echo "forced SQL error" >&2
	if [ "$on_error_stop" = true ]; then
		exit 3
	fi
fi
EOF
chmod +x "$test_dir/bin/psql"

cat >"$test_dir/failing.sql" <<'EOF'
SELECT 1;
SELECT forced_sql_error;
SELECT 2;
EOF

PATH="$test_dir/bin:$PATH"
export PATH
export PGDATA="$test_dir/pgdata"
export POSTGRES_DB=local
export SERVER_AVAILABLE_TRACE="$test_dir/server-available"
export SERVER_STOP="$test_dir/server-stop"
mkdir -p "$PGDATA"

helper_status=0
run_psql_file "$POSTGRES_DB" "$test_dir/failing.sql" \
	>"$test_dir/helper-stdout" 2>"$test_dir/helper-stderr" || helper_status=$?
if [ "$helper_status" -eq 0 ]; then
	echo "run_psql_file did not report the SQL error" >&2
	exit 1
fi

# Exercise the actual startup guard with a live stand-in for PostgreSQL. The
# Nhost step observes that the server remains available after the init SQL
# failure, then allows the stand-in to exit cleanly.
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
	run_psql_file "$POSTGRES_DB" "$test_dir/failing.sql"
}

run_nhost_scripts() {
	kill -0 "$POSTGRES_PID"
	: >"$SERVER_AVAILABLE_TRACE"
	: >"$SERVER_STOP"
}

delete_core_dumps() {
	:
}

(main) >"$test_dir/main-stdout" 2>"$test_dir/main-stderr"

grep -Fq \
	"Initialization script execution failed; continuing PostgreSQL startup" \
	"$test_dir/main-stderr"
if [ ! -f "$SERVER_AVAILABLE_TRACE" ]; then
	echo "startup did not continue with PostgreSQL available" >&2
	exit 1
fi
