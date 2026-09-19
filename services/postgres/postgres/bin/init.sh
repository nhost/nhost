#!/bin/sh

set -eu

wait_for_interruptible() {
	if wait "$IN_FLIGHT_PID"; then
		interruptible_exit_code=0
	else
		interruptible_exit_code=$?
	fi

	IN_FLIGHT_PID=
	return "$interruptible_exit_code"
}

run_interruptibly() {
	"$@" &
	IN_FLIGHT_PID=$!
	wait_for_interruptible
}

run_with_input_interruptibly() {
	input=$1
	shift
	printf '%s\n' "$input" | "$@" &
	IN_FLIGHT_PID=$!
	wait_for_interruptible
}

init_db() {
	DATABASE_INITIALIZED=false

	if [ ! -f "$PGDATA/PG_VERSION" ]; then
		echo "Initializing database"
		if ! run_with_input_interruptibly "$POSTGRES_PASSWORD" \
			initdb --username="$POSTGRES_USER" --pwfile=/dev/stdin; then
			return 1
		fi

		DATABASE_INITIALIZED=true
	fi
	export DATABASE_INITIALIZED
}

resolve_config() {
	echo "Resolving pg_hba.conf and postgresql.conf"
	POSTGRES_DEV_INSECURE=${POSTGRES_DEV_INSECURE:-}
	if [ -n "$POSTGRES_DEV_INSECURE" ]; then
		PG_HBA_CONF_TMPL=/etc/pg_hba_insecure.conf.tmpl
	else
		PG_HBA_CONF_TMPL=/etc/pg_hba.conf.tmpl
	fi
	envsubst <"$PG_HBA_CONF_TMPL" >/tmp/postgresql/pg_hba.conf
	envsubst </etc/postgresql.conf.tmpl >/tmp/postgresql/postgresql.conf
}

wait_for_postgres() {
	echo "Waiting for postgres to start"
	# wait for postgres to start
	while ! pg_isready -q; do
		# Check if postgres process is still running
		if ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
			echo "PostgreSQL process (PID: $POSTGRES_PID) is no longer running"
			exit 1
		fi
		run_interruptibly sleep 0.5
	done
}

wait_for_postgres_promotion() {
	echo "Waiting for postgres to finish recovery and promote"
	while kill -0 "$POSTGRES_PID" 2>/dev/null; do
		in_recovery=
		if in_recovery=$(
			psql -X -q -A -t -U postgres -d postgres -v ON_ERROR_STOP=1 \
				-c 'SELECT pg_is_in_recovery();' 2>/dev/null
		) && [ "$in_recovery" = f ] && kill -0 "$POSTGRES_PID" 2>/dev/null; then
			return 0
		fi
		run_interruptibly sleep 10
	done

	exit_code=0
	wait "$POSTGRES_PID" || exit_code=$?
	echo "PostgreSQL recovery process exited before promotion with code: $exit_code" >&2
	if [ "$exit_code" -eq 0 ]; then
		return 1
	fi
	return "$exit_code"
}

start_postgres() {
	echo "Starting postgres"
	chmod u=rwx,g=rx "$PGDATA"
	exec postgres \
		-h 0.0.0.0 \
		-p 5432 \
		-c config_file="/tmp/postgresql/postgresql.conf" \
		-c hba_file="/tmp/postgresql/pg_hba.conf"
}

delete_core_dumps() {
	while true; do
		find "$PGDATA" -type f -name "core.*" -exec rm -f {} \;
		sleep 60
	done
}

run_psql_file() {
	database=$1
	file=$2

	if [ "${3:-}" = continue_on_sql_error ]; then
		run_interruptibly psql -X -q -b -U postgres -d "$database" -f "$file"
	else
		run_interruptibly psql -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 -f "$file"
	fi
}

run_init_scripts() {
	echo "Running init scripts"
	run_interruptibly createdb -U postgres "$POSTGRES_DB" || return 1

	mkdir -p /tmp/postgresql/initdb.d || return 1
	for f in /initdb.d/*; do
		filename=$(basename "$f") || return 1
		rendered_file="/tmp/postgresql/initdb.d/$filename"
		envsubst <"$f" >"$rendered_file" || return 1
		# SQL errors are logged by psql; keep processing first-boot setup files.
		# PG_VERSION prevents automatic retries, so operators must repair missing setup.
		run_psql_file "$POSTGRES_DB" "$rendered_file" continue_on_sql_error || return 1
	done
}

run_nhost_scripts() {
	echo "Running nhost's scripts"

	mkdir -p /tmp/postgresql/nhost.d || return 1
	for f in /nhost.d/*; do
		filename=$(basename "$f") || return 1
		rendered_file="/tmp/postgresql/nhost.d/$filename"
		envsubst <"$f" >"$rendered_file" || return 1

		run_psql_file "$POSTGRES_DB" "$rendered_file" || return 1
	done
}

pitr_preflight() {
	echo "pitr_recover: checking backup storage and selector $PITR_BASEBACKUP"
	pitr_backup_list=$(mktemp "${TMPDIR:-/tmp/postgresql}/pitr-backup-list.XXXXXX") || return 1

	if wal-g backup-list >"$pitr_backup_list"; then
		:
	else
		status=$?
		rm -f "$pitr_backup_list"
		echo "pitr_recover: preflight failed while listing backups" >&2
		return "$status"
	fi

	backup_available=false
	if [ "$PITR_BASEBACKUP" = LATEST ]; then
		if awk 'NR > 1 { found = 1 } END { exit !found }' "$pitr_backup_list"; then
			backup_available=true
		fi
	elif awk -v requested="$PITR_BASEBACKUP" \
		'NR > 1 && $1 == requested { found = 1 } END { exit !found }' \
		"$pitr_backup_list"; then
		backup_available=true
	fi
	rm -f "$pitr_backup_list" || return 1

	if [ "$backup_available" != true ]; then
		echo "pitr_recover: preflight failed: backup selector $PITR_BASEBACKUP is not available" >&2
		return 1
	fi
}

# Import jobs request a time in the future to mean "replay available WAL".
# PostgreSQL cannot reach that time and fails recovery at the end of the archive.
# Only use end-of-WAL recovery for promotion: other PITR targets remain strict.
pitr_restore_to_end_of_wal() {
	[ "$PITR_TARGET_ACTION" = promote ] || return 1

	# BusyBox date accepts SQL-style timestamps, but not ISO T/Z or fractional
	# seconds. If it cannot parse the target, leave interpretation to PostgreSQL.
	date_target=$(printf '%s\n' "$PITR_RECOVERY_TARGET" |
		sed -E 's/T/ /; s/\.[0-9]+([+-][0-9][0-9](:?[0-9][0-9])?|Z)?$/\1/; s/Z$/+00:00/')
	target_seconds=$(date -u -d "$date_target" +%s 2>/dev/null) || return 1
	now_seconds=$(date -u +%s) || return 1
	[ "$target_seconds" -ge "$now_seconds" ]
}

pitr_restore() {
	pitr_preflight || return $?
	PITR_RESTORE_TO_END_OF_WAL=false
	if pitr_restore_to_end_of_wal; then
		PITR_RESTORE_TO_END_OF_WAL=true
		echo "pitr_recover: future target $PITR_RECOVERY_TARGET; replaying available WAL"
	fi

	# The preflight catches unreachable storage and unknown selectors, but the
	# direct fetch is intentionally not atomic: a fetch failure can leave a
	# partial PGDATA after the existing cluster has been removed.
	echo "Cleaning up PGDATA"
	run_interruptibly rm -rf "$PGDATA" || return 1
	echo "pitr_recover: fetching $PITR_BASEBACKUP"
	if run_interruptibly wal-g backup-fetch "$PGDATA" "$PITR_BASEBACKUP"; then
		:
	else
		status=$?
		echo "pitr_recover: backup-fetch failed after PGDATA was removed; PGDATA may be partial" >&2
		return "$status"
	fi
	echo "pitr_recover: finished fetching  $PITR_BASEBACKUP"
	if [ "$PITR_RESTORE_TO_END_OF_WAL" = false ]; then
		echo "pitr_recover: setting recovery target to $PITR_RECOVERY_TARGET"
	else
		echo "pitr_recover: promoting at end of available WAL (not at $PITR_RECOVERY_TARGET)"
	fi
	rm -f "$PGDATA/postgresql.auto.conf" || return 1
	{
		if [ "$PITR_RESTORE_TO_END_OF_WAL" = false ]; then
			echo "recovery_target_time = '$PITR_RECOVERY_TARGET'"
		fi
		echo "recovery_target_action = '$PITR_TARGET_ACTION'"
		echo "recovery_target_timeline = '$PITR_TARGET_TIMELINE'"
		echo "restore_command = '/bin/wal-fetch.sh \"%f\" \"%p\"'"
	} >"$PGDATA/postgresql.auto.conf" || return 1
	touch "$PGDATA/recovery.signal"
}

post_restore_sql() {
	post_restore_sql_failed=false

	if [ -n "${PITR_POST_RESTORE_SQL_NO_DB:-}" ]; then
		echo "Running post restore SQL without database connection"
		if ! run_interruptibly psql -X -U postgres -c "$PITR_POST_RESTORE_SQL_NO_DB"; then
			echo "Post-restore SQL without a database connection failed" >&2
			post_restore_sql_failed=true
		fi
	fi

	if [ -n "${PITR_POST_RESTORE_SQL:-}" ]; then
		echo "Running post restore SQL with database connection"
		if ! run_interruptibly psql -X -U postgres -d "$POSTGRES_DB" \
			-c "$PITR_POST_RESTORE_SQL"; then
			echo "Post-restore SQL with a database connection failed" >&2
			post_restore_sql_failed=true
		fi
	fi

	if [ "$post_restore_sql_failed" = true ]; then
		return 1
	fi
}

# shellcheck disable=SC2329 # Called only by signal and exit trap handlers.
stop_postgres() {
	if [ -z "${POSTGRES_PID:-}" ] || ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
		return 0
	fi

	if [ ! -f "$PGDATA/postmaster.pid" ]; then
		kill -TERM "$POSTGRES_PID" 2>/dev/null || true
		wait "$POSTGRES_PID" 2>/dev/null || true
		return 0
	fi

	# Fast mode disconnects clients, and --wait keeps PID 1 alive until the
	# server has checkpointed and removed its PID file.
	pg_ctl stop --pgdata="$PGDATA" --mode=fast --wait
}

# shellcheck disable=SC2329 # Invoked by the signal trap.
shutdown_postgres() {
	trap '' TERM INT
	trap - EXIT
	echo "Received shutdown signal, shutting down PostgreSQL..."

	if [ -n "${IN_FLIGHT_PID:-}" ] && kill -0 "$IN_FLIGHT_PID" 2>/dev/null; then
		kill -TERM "$IN_FLIGHT_PID" 2>/dev/null || true
		wait "$IN_FLIGHT_PID" 2>/dev/null || true
		IN_FLIGHT_PID=
	fi

	if ! stop_postgres; then
		echo "Failed to stop PostgreSQL cleanly" >&2
		exit 1
	fi
	exit 0
}

# shellcheck disable=SC2329 # Invoked by the exit trap.
shutdown_postgres_after_error() {
	entrypoint_exit_code=$?
	trap - EXIT

	if [ "$entrypoint_exit_code" -ne 0 ] &&
		[ -n "${POSTGRES_PID:-}" ] && kill -0 "$POSTGRES_PID" 2>/dev/null; then
		echo "Entrypoint failed, shutting down PostgreSQL..." >&2
		if ! stop_postgres; then
			echo "Failed to stop PostgreSQL cleanly after entrypoint error" >&2
		fi
	fi

	exit "$entrypoint_exit_code"
}

main() {
	IN_FLIGHT_PID=
	POSTGRES_PID=
	trap shutdown_postgres TERM INT
	trap shutdown_postgres_after_error EXIT

	if [ -n "${PITR_BASEBACKUP:-}" ]; then
		resolve_config
		pitr_restore

		if [ "$PITR_TARGET_ACTION" = "promote" ]; then
			start_postgres &
			POSTGRES_PID=$!
			wait_for_postgres_promotion
			post_restore_status=0
			post_restore_sql || post_restore_status=$?
			pg_ctl stop
			wait "$POSTGRES_PID"
			if [ "$post_restore_status" -ne 0 ]; then
				return "$post_restore_status"
			fi
		else
			start_postgres &
			POSTGRES_PID=$!
			echo "PostgreSQL started with PID: $POSTGRES_PID"
			wait "$POSTGRES_PID"
		fi
		exit 0
	fi

	init_db
	resolve_config

	# we delete just in case. This file is usually removed by postgres
	# but it won't if the restore failed for some reason. For instance,
	# if the specified time is later than the last recorded operation
	rm -f "$PGDATA/recovery.signal"
	start_postgres &
	POSTGRES_PID=$!
	echo "PostgreSQL started with PID: $POSTGRES_PID"

	wait_for_postgres

	if [ "$DATABASE_INITIALIZED" = true ]; then
		if ! run_init_scripts; then
			echo "Initialization script execution failed; continuing PostgreSQL startup" >&2
		fi
	fi

	# Rebuild collation-dependent indexes only after the available collation
	# version changes, before recording the new version. A failed rebuild must
	# not make PostgreSQL unavailable to the operator who needs to repair it.
	if ! run_interruptibly /bin/repair-collation.sh; then
		echo "Collation repair failed; continuing PostgreSQL startup" >&2
	fi
	if ! run_nhost_scripts; then
		echo "Nhost script execution failed; continuing PostgreSQL startup" >&2
	fi

	delete_core_dumps &
	echo "PostgreSQL initialization complete"

	# Simply wait for postgres
	EXIT_CODE=0
	wait "$POSTGRES_PID" || EXIT_CODE=$?
	echo "PostgreSQL exited with code: $EXIT_CODE"

	if [ -n "${DEBUG:-}" ]; then
		echo "DEBUG mode enabled, keeping container running for debugging"
		sleep infinity
	fi

	exit "$EXIT_CODE"
}

main
