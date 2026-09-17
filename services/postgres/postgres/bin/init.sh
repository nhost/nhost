#!/bin/sh

set -eu

run_interruptibly() {
	# POSIX asynchronous commands receive /dev/null on stdin, so callers must
	# pass all required input as command arguments rather than redirections.
	"$@" &
	IN_FLIGHT_PID=$!

	if wait "$IN_FLIGHT_PID"; then
		interruptible_exit_code=0
	else
		interruptible_exit_code=$?
	fi

	IN_FLIGHT_PID=
	return "$interruptible_exit_code"
}

write_init_state() {
	printf '%s\n' "$1" >"$INIT_STATE_FILE.tmp"
	mv "$INIT_STATE_FILE.tmp" "$INIT_STATE_FILE"
}

init_db() {
	DATABASE_INITIALIZED=false
	INIT_STATE_FILE="$PGDATA/.nhost-init-state"
	INIT_CLUSTER_DIR="$PGDATA/.nhost-init-cluster"
	mkdir -p "$PGDATA"

	if [ ! -f "$INIT_STATE_FILE" ] && [ -f "$INIT_STATE_FILE.tmp" ]; then
		mv "$INIT_STATE_FILE.tmp" "$INIT_STATE_FILE"
	fi

	if [ -f "$INIT_STATE_FILE" ]; then
		initialization_state=$(cat "$INIT_STATE_FILE")
		case "$initialization_state" in
		in-progress)
			echo "Restarting interrupted database initialization"
			run_interruptibly find "$PGDATA" -mindepth 1 -maxdepth 1 \
				! -name .nhost-init-state -exec rm -rf -- {} +
			;;
		complete)
			if [ ! -f "$PGDATA/PG_VERSION" ]; then
				echo "Database initialization is marked complete, but PG_VERSION is missing" >&2
				return 1
			fi
			;;
		*)
			echo "Invalid database initialization state: $initialization_state" >&2
			return 1
			;;
		esac
	elif [ -f "$PGDATA/PG_VERSION" ]; then
		# Volumes created by older images predate the initialization marker.
		write_init_state complete
	elif [ -n "$(find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit)" ]; then
		echo "Database directory is not empty, but PG_VERSION is missing" >&2
		return 1
	fi

	if [ ! -f "$PGDATA/PG_VERSION" ]; then
		echo "Initializing database"
		write_init_state in-progress
		password_file=$(mktemp -p /tmp/postgresql postgres-password.XXXXXX)
		chmod 600 "$password_file"
		printf '%s\n' "$POSTGRES_PASSWORD" >"$password_file"

		if ! run_interruptibly initdb \
			--pgdata="$INIT_CLUSTER_DIR" \
			--username="$POSTGRES_USER" \
			--pwfile="$password_file"; then
			rm -f "$password_file"
			return 1
		fi

		rm -f "$password_file"
		run_interruptibly find "$INIT_CLUSTER_DIR" -mindepth 1 -maxdepth 1 \
			-exec mv -- {} "$PGDATA" \;
		rmdir "$INIT_CLUSTER_DIR"
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

wait_for_postgres_slow() {
	echo "Waiting for postgres to start"
	# wait for postgres to start
	while ! pg_isready -q; do
		# Check if postgres process is still running
		if ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
			# We try to start postgres normally in case postgres shutdowns
			# instead of promoting the server to allow for the post_restore_sql to run
			echo "PostgreSQL process (PID: $POSTGRES_PID) is no longer running. Starting postgres normally..."
			rm -f "$PGDATA/recovery.signal"
			rm -f "$PGDATA/postgresql.auto.conf"
			start_postgres &
			POSTGRES_PID=$!
			echo "PostgreSQL restarted with PID: $POSTGRES_PID"
			wait_for_postgres
			return
		fi
		run_interruptibly sleep 10
	done
}

start_postgres() {
	echo "Starting postgres"
	chmod u=rwx,g=rx,o= "$PGDATA"
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

	run_interruptibly psql -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 -f "$file"
}

run_init_scripts() {
	echo "Running init scripts"
	run_interruptibly createdb -U postgres "$POSTGRES_DB"

	mkdir -p /tmp/postgresql/initdb.d
	for f in /initdb.d/*; do
		filename=$(basename "$f")
		rendered_file="/tmp/postgresql/initdb.d/$filename"
		envsubst <"$f" >"$rendered_file"
		run_psql_file "$POSTGRES_DB" "$rendered_file"
	done
}

run_nhost_scripts() {
	echo "Running nhost's scripts"

	mkdir -p /tmp/postgresql/nhost.d
	for f in /nhost.d/*; do
		filename=$(basename "$f")
		rendered_file="/tmp/postgresql/nhost.d/$filename"
		envsubst <"$f" >"$rendered_file"

		run_psql_file "$POSTGRES_DB" "$rendered_file"
	done
}

pitr_restore() {
	echo "Cleaning up PGDATA"
	run_interruptibly rm -rf "$PGDATA"
	echo "pitr_recover: fetching $PITR_BASEBACKUP"
	run_interruptibly wal-g backup-fetch "$PGDATA" "$PITR_BASEBACKUP"
	echo "pitr_recover: finished fetching  $PITR_BASEBACKUP"
	echo "pitr_recover: setting recovery target to $PITR_RECOVERY_TARGET"
	rm -f "$PGDATA/postgresql.auto.conf"
	{
		echo "recovery_target_time = '$PITR_RECOVERY_TARGET'"
		echo "recovery_target_action = '$PITR_TARGET_ACTION'"
		echo "recovery_target_timeline = '$PITR_TARGET_TIMELINE'"
		echo "restore_command = 'wal-g wal-fetch \"%f\" \"%p\"'"
	} >"$PGDATA/postgresql.auto.conf"
	touch "$PGDATA/recovery.signal"
}

post_restore_sql() {
	if [ -n "${PITR_POST_RESTORE_SQL_NO_DB:-}" ]; then
		echo "Running post restore SQL without database connection"
		run_interruptibly psql -X -U postgres -v ON_ERROR_STOP=1 -c "$PITR_POST_RESTORE_SQL_NO_DB"
	fi

	if [ -n "${PITR_POST_RESTORE_SQL:-}" ]; then
		echo "Running post restore SQL with database connection"
		run_interruptibly psql -X -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "$PITR_POST_RESTORE_SQL"
	fi
}

# shellcheck disable=SC2329 # Invoked by the signal trap.
shutdown_postgres() {
	trap '' TERM INT
	echo "Received shutdown signal, shutting down PostgreSQL..."

	if [ -n "${IN_FLIGHT_PID:-}" ] && kill -0 "$IN_FLIGHT_PID" 2>/dev/null; then
		kill -TERM "$IN_FLIGHT_PID" 2>/dev/null || true
		wait "$IN_FLIGHT_PID" 2>/dev/null || true
		IN_FLIGHT_PID=
	fi

	if [ -z "${POSTGRES_PID:-}" ] || ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
		exit 0
	fi

	if [ ! -f "$PGDATA/postmaster.pid" ]; then
		kill -TERM "$POSTGRES_PID" 2>/dev/null || true
		wait "$POSTGRES_PID" 2>/dev/null || true
		exit 0
	fi

	# Fast mode disconnects clients, and --wait keeps PID 1 alive until the
	# server has checkpointed and removed its PID file.
	if ! pg_ctl stop --pgdata="$PGDATA" --mode=fast --wait; then
		echo "Failed to stop PostgreSQL cleanly" >&2
		exit 1
	fi
	exit 0
}

main() {
	IN_FLIGHT_PID=
	POSTGRES_PID=
	trap shutdown_postgres TERM INT

	if [ -n "${PITR_BASEBACKUP:-}" ]; then
		resolve_config
		pitr_restore

		if [ "$PITR_TARGET_ACTION" = "promote" ]; then
			start_postgres &
			POSTGRES_PID=$!
			wait_for_postgres_slow
			post_restore_sql
			pg_ctl stop
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
		run_init_scripts
		write_init_state complete
	fi
	run_nhost_scripts

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
