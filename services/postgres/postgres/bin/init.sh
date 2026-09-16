#!/bin/sh

set -eu

init_db() {
	DATABASE_INITIALIZED=false
	if [ ! -f "$PGDATA/PG_VERSION" ]; then
		echo "Initializing database"
		password_file=$(mktemp -p /tmp/postgresql postgres-password.XXXXXX)
		chmod 600 "$password_file"
		printf '%s\n' "$POSTGRES_PASSWORD" >"$password_file"

		if ! initdb --username="$POSTGRES_USER" --pwfile="$password_file"; then
			rm -f "$password_file"
			return 1
		fi

		rm -f "$password_file"
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
		sleep 0.5
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
		sleep 10
	done
}

start_postgres() {
	echo "Starting postgres"
	chmod u=rwx,g=rx "$PGDATA"
	postgres \
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

	psql -X -q -b -U postgres -d "$database" -v ON_ERROR_STOP=1 -f "$file"
}

run_init_scripts() {
	echo "Running init scripts"
	createdb -U postgres "$POSTGRES_DB"

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
	rm -rf "$PGDATA"
	echo "pitr_recover: fetching $PITR_BASEBACKUP"
	wal-g backup-fetch "$PGDATA" "$PITR_BASEBACKUP"
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
		psql -X -U postgres -v ON_ERROR_STOP=1 -c "$PITR_POST_RESTORE_SQL_NO_DB"
	fi

	if [ -n "${PITR_POST_RESTORE_SQL:-}" ]; then
		echo "Running post restore SQL with database connection"
		psql -X -U postgres -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "$PITR_POST_RESTORE_SQL"
	fi
}

main() {
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
			start_postgres
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
	fi
	run_nhost_scripts

	delete_core_dumps &

	# Setup signal handling
	trap 'echo "Received SIGTERM, shutting down PostgreSQL..."; kill -TERM "$POSTGRES_PID"; wait "$POSTGRES_PID"' TERM

	# Simply wait for postgres
	EXIT_CODE=0
	wait "$POSTGRES_PID" || EXIT_CODE=$?
	echo "PostgreSQL exited with code: $EXIT_CODE"

	if [ -n "${DEBUG:-}" ]; then
		echo "DEBUG mode enabled, keeping container running for debugging"
		sleep infinity
	fi

	exit $EXIT_CODE
}

main
