#!/bin/sh

set -eu

repair_database() {
	database=$1

	if ! collation_mismatch=$(psql -X -q -A -t -b -U postgres -d "$database" \
		-v ON_ERROR_STOP=1 -c '
SELECT datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
FROM pg_database
WHERE datname = current_database();
'); then
		echo "Failed to check the database collation version" >&2
		return 1
	fi

	case $collation_mismatch in
	f)
		return 0
		;;
	t)
		;;
	*)
		echo "Unexpected database collation mismatch result" >&2
		return 1
		;;
	esac

	if ! psql -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format(
    'Rebuilding collation-dependent indexes in database %I',
    current_database()
) AS repair_message
\gset
\echo :repair_message

SELECT format('REINDEX DATABASE %I', current_database())
\gexec
SQL
	then
		echo "Failed to rebuild collation-dependent indexes" >&2
		return 1
	fi

	if ! psql -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 <<'SQL'
SELECT format(
    'ALTER DATABASE %I REFRESH COLLATION VERSION',
    current_database()
)
\gexec
SQL
	then
		echo "Failed to refresh the database collation version" >&2
		return 1
	fi
}

# shellcheck disable=SC2329 # Invoked by the signal and exit traps.
cleanup_repair() {
	repair_exit_code=$?
	trap - EXIT HUP INT TERM

	if [ -n "${repair_pid:-}" ]; then
		kill -TERM "$repair_pid" 2>/dev/null || true
		wait "$repair_pid" 2>/dev/null || true
	fi
	rm -f "${database_file:-}"

	exit "$repair_exit_code"
}

wait_for_repair() {
	if wait "$repair_pid"; then
		repair_exit_code=0
	else
		repair_exit_code=$?
	fi
	repair_pid=

	return "$repair_exit_code"
}

repair_all_databases() {
	database_file=$(mktemp "${TMPDIR:-/tmp/postgresql}/collation-databases.XXXXXX")
	repair_pid=
	trap cleanup_repair EXIT
	trap 'exit 129' HUP
	trap 'exit 130' INT
	trap 'exit 143' TERM

	psql -X -q -A -t -0 -b -U postgres -d postgres -v ON_ERROR_STOP=1 \
		-c '
SELECT datname
FROM pg_database
WHERE datallowconn
  AND datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
ORDER BY datname;
' >"$database_file" &
	repair_pid=$!
	if ! wait_for_repair; then
		echo "Failed to list databases with collation version mismatches" >&2
		return 1
	fi

	if [ -s "$database_file" ]; then
		xargs -0 -n 1 "$0" --database <"$database_file" &
		repair_pid=$!
		if ! wait_for_repair; then
			echo "Failed to repair database collation versions" >&2
			return 1
		fi
	fi
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
	# xargs stops immediately when a child exits 255. Normalize every repair
	# failure to 1 so it still invokes this mode for the remaining databases.
	if ! repair_database "$2"; then
		echo "Failed to repair a database collation version" >&2
		exit 1
	fi
	;;
*)
	echo "usage: $0 [--database <database>]" >&2
	exit 2
	;;
esac
