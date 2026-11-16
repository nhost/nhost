#!/bin/sh

set -eu

repair_script=${1:?"usage: $0 <repair-collation-script>"}
test_database="collation_repair_test_$$"
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/repair-collation-integration.XXXXXX")

psql_admin() {
	psql -X -q -b -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_database() {
	psql -X -q -b -U postgres -d "$test_database" -v ON_ERROR_STOP=1 "$@"
}

cleanup() {
	psql_admin -v test_database="$test_database" <<'SQL' >/dev/null 2>&1 || true
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'test_database'
  AND pid <> pg_backend_pid();
SELECT format('DROP DATABASE IF EXISTS %I', :'test_database')
\gexec
SQL
	rm -rf "$test_dir"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

psql_admin -v test_database="$test_database" <<'SQL'
SELECT format('CREATE DATABASE %I TEMPLATE template0', :'test_database')
\gexec
SQL

psql_database <<'SQL'
CREATE TABLE duplicate_values (value text);
CREATE UNIQUE INDEX duplicate_values_value_key ON duplicate_values (value);
INSERT INTO duplicate_values VALUES ('duplicate');
UPDATE pg_index
SET indisunique = false
WHERE indexrelid = 'duplicate_values_value_key'::regclass;
INSERT INTO duplicate_values VALUES ('duplicate');
UPDATE pg_index
SET indisunique = true
WHERE indexrelid = 'duplicate_values_value_key'::regclass;
SQL

psql_admin -v test_database="$test_database" <<'SQL'
UPDATE pg_database
SET datcollversion = '0-test-stale'
WHERE datname = :'test_database';
SQL

repair_status=0
sh "$repair_script" --database "$test_database" \
	>"$test_dir/failed-stdout" 2>"$test_dir/failed-stderr" || repair_status=$?
if [ "$repair_status" -ne 1 ]; then
	echo "repair returned $repair_status, expected 1 for duplicate values" >&2
	exit 1
fi
grep -Fq "Failed to rebuild collation-dependent indexes" \
	"$test_dir/failed-stderr"

available=$(psql_database -A -t -c 'SELECT 1;')
if [ "$available" != 1 ]; then
	echo "PostgreSQL was not available after the failed repair" >&2
	exit 1
fi

mismatch=$(
	psql_admin -A -t -v test_database="$test_database" <<'SQL'
SELECT datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
FROM pg_database
WHERE datname = :'test_database';
SQL
)
if [ "$mismatch" != t ]; then
	echo "failed repair did not preserve the collation version mismatch" >&2
	exit 1
fi

failed_reindex_node=$(
	psql_database -A -t \
		-c "SELECT pg_relation_filenode('duplicate_values_value_key'::regclass);"
)
psql_database <<'SQL'
DELETE FROM duplicate_values
WHERE ctid = (SELECT ctid FROM duplicate_values LIMIT 1);
SQL

sh "$repair_script" --database "$test_database" \
	>"$test_dir/repaired-stdout" 2>"$test_dir/repaired-stderr"

mismatch=$(
	psql_admin -A -t -v test_database="$test_database" <<'SQL'
SELECT datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
FROM pg_database
WHERE datname = :'test_database';
SQL
)
if [ "$mismatch" != f ]; then
	echo "successful repair did not refresh the collation version" >&2
	exit 1
fi

repaired_index_node=$(
	psql_database -A -t \
		-c "SELECT pg_relation_filenode('duplicate_values_value_key'::regclass);"
)
if [ "$failed_reindex_node" = "$repaired_index_node" ]; then
	echo "successful repair did not rebuild the unique index" >&2
	exit 1
fi
