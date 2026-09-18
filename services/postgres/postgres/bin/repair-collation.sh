#!/bin/sh

set -eu

PSQL=${PSQL:-psql}
XARGS=${XARGS:-xargs}

repair_database() {
	database=$1

	"$PSQL" -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 <<'SQL'
SELECT
    datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
        AS collation_mismatch
FROM pg_database
WHERE datname = current_database()
\gset

\if :collation_mismatch
SELECT format(
    'Rebuilding collation-dependent indexes in database %I',
    current_database()
) AS repair_message
\gset
\echo :repair_message

SELECT format('REINDEX DATABASE %I', current_database())
\gexec

SELECT format(
    'ALTER DATABASE %I REFRESH COLLATION VERSION',
    current_database()
)
\gexec
\endif
SQL
}

repair_all_databases() {
	database_file=$(mktemp "${TMPDIR:-/tmp/postgresql}/collation-databases.XXXXXX")
	trap 'rm -f "$database_file"' EXIT HUP INT TERM

	if ! "$PSQL" -X -q -A -t -0 -b -U postgres -d postgres -v ON_ERROR_STOP=1 \
		-c '
SELECT datname
FROM pg_database
WHERE datallowconn
  AND datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
ORDER BY datname;
' >"$database_file"; then
		echo "Failed to list databases with collation version mismatches" >&2
		return 1
	fi

	if [ -s "$database_file" ] && ! "$XARGS" -0 -n 1 "$0" --database <"$database_file"; then
		echo "Failed to repair database collation versions" >&2
		return 1
	fi

	rm -f "$database_file"
}

case ${1:-} in
"")
	repair_all_databases
	;;
--database)
	if [ "$#" -ne 2 ]; then
		echo "usage: $0 --database <database>" >&2
		exit 2
	fi
	repair_database "$2"
	;;
*)
	echo "usage: $0 [--database <database>]" >&2
	exit 2
	;;
esac
