#!/bin/sh

set -euo pipefail

function init_db() {
    DATABASE_INITALIZED=false
    if [ ! -f $PGDATA/PG_VERSION ]; then
        echo "Initializing database"
        eval 'initdb --username="$POSTGRES_USER" --pwfile=<(printf "%s\n" "$POSTGRES_PASSWORD")'
        DATABASE_INITALIZED=true
    fi
    export DATABASE_INITALIZED
}

function resolve_config() {
    echo "Resolving pg_hba.conf and postgresql.conf"
    POSTGRES_DEV_INSECURE=${POSTGRES_DEV_INSECURE:-}
    if [[ -n "$POSTGRES_DEV_INSECURE" ]]; then
        PG_HBA_CONF_TMPL=/etc/pg_hba_insecure.conf.tmpl
    else
        PG_HBA_CONF_TMPL=/etc/pg_hba.conf.tmpl
    fi
    envsubst < "$PG_HBA_CONF_TMPL" > /tmp/postgresql/pg_hba.conf
    envsubst < /etc/postgresql.conf.tmpl > /tmp/postgresql/postgresql.conf
}


function wait_for_postgres() {
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


function wait_for_postgres_slow() {
    echo "Waiting for postgres to start"
    # wait for postgres to start
    while ! pg_isready -q; do
        # Check if postgres process is still running
        if ! kill -0 "$POSTGRES_PID" 2>/dev/null; then
            # We try to start postgres normally in case postgres shutdowns
            # instead of promoting the server to allow for the post_restore_sql to run
            echo "PostgreSQL process (PID: $POSTGRES_PID) is no longer running. Starting postgres normally..."
            rm -f $PGDATA/recovery.signal
            rm -f $PGDATA/postgresql.auto.conf
            start_postgres &
            POSTGRES_PID=$!
            echo "PostgreSQL restarted with PID: $POSTGRES_PID"
            wait_for_postgres
            return
        fi
        sleep 10
    done
}


function start_postgres() {
    echo "Starting postgres"
    chmod u=rwx,g=rx $PGDATA
    postgres \
        -h 0.0.0.0 \
        -p 5432 \
        -c config_file="/tmp/postgresql/postgresql.conf" \
        -c hba_file="/tmp/postgresql/pg_hba.conf"
}

function delete_core_dumps() {
    while true; do
        find "$PGDATA" -type f -name "core.*" -exec rm -f {} \;
        sleep 60
    done
}

function run_init_scripts() {
    echo "Running init scripts"
    psql --dbname postgres -c "CREATE DATABASE $POSTGRES_DB;"

    mkdir -p /tmp/postgresql/initdb.d
    for f in /initdb.d/*; do
        envsubst < "$f" > /tmp/postgresql/initdb.d/$(basename $f)
        psql -q -b -U postgres -d $POSTGRES_DB --no-psqlrc -f /tmp/postgresql/initdb.d/$(basename $f)
    done
}

function run_nhost_scripts() {
    echo "Running nhost's scripts"

    mkdir -p /tmp/postgresql/nhost.d
    for f in /nhost.d/*; do
        envsubst < "$f" > /tmp/postgresql/nhost.d/$(basename $f)
        psql -q -b -U postgres -d $POSTGRES_DB --no-psqlrc -f /tmp/postgresql/nhost.d/$(basename $f)
    done
}

function pitr_restore() {
    echo "Cleaning up PGDATA"
    rm -rf $PGDATA
    echo "pitr_recover: fetching $PITR_BASEBACKUP"
    wal-g backup-fetch $PGDATA $PITR_BASEBACKUP
    echo "pitr_recover: finished fetching  $PITR_BASEBACKUP"
    echo "pitr_recover: setting recovery target to $PITR_RECOVERY_TARGET"
    rm -f $PGDATA/postgresql.auto.conf
    echo "recovery_target_time = '$PITR_RECOVERY_TARGET'" > $PGDATA/postgresql.auto.conf
    echo "recovery_target_action = '$PITR_TARGET_ACTION'" >> $PGDATA/postgresql.auto.conf
    echo "recovery_target_timeline = '$PITR_TARGET_TIMELINE'" >> $PGDATA/postgresql.auto.conf
    echo "restore_command = 'wal-g wal-fetch \"%f\" \"%p\"'" >> $PGDATA/postgresql.auto.conf
    touch $PGDATA/recovery.signal
}

function post_restore_sql() {
    if [ -n "${PITR_POST_RESTORE_SQL_NO_DB:-}" ]; then
        echo "Running post restore SQL without database connection"
        psql -U postgres -c "$PITR_POST_RESTORE_SQL_NO_DB"
    fi

    if [ -n "${PITR_POST_RESTORE_SQL:-}" ]; then
        echo "Running post restore SQL with database connection"
        psql -U postgres $POSTGRES_DB -c "$PITR_POST_RESTORE_SQL"
    fi
}

function main() {
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
    rm -f $PGDATA/recovery.signal
    start_postgres &
    POSTGRES_PID=$!
    echo "PostgreSQL started with PID: $POSTGRES_PID"

    wait_for_postgres

    if [ "$DATABASE_INITALIZED" = true ]; then
        run_init_scripts
    fi
    run_nhost_scripts

    delete_core_dumps &

    # Setup signal handling
    trap 'echo "Received SIGTERM, shutting down PostgreSQL..."; kill -TERM $POSTGRES_PID; wait $POSTGRES_PID' TERM

    # Simply wait for postgres
    wait $POSTGRES_PID
    EXIT_CODE=$?
    echo "PostgreSQL exited with code: $EXIT_CODE"

    if [ -n "${DEBUG:-}" ]; then
        echo "DEBUG mode enabled, keeping container running for debugging"
        sleep infinity
    fi

    exit $EXIT_CODE
}

main
