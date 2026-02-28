#!/bin/sh
DUMP_FILE="auth_schema_dump.sql"

pg_dump -s -n auth postgres://postgres:postgres@localhost:5432/local > $DUMP_FILE

sed '/^\\restrict /d;/^\\unrestrict /d' $DUMP_FILE > $DUMP_FILE.tmp && mv $DUMP_FILE.tmp $DUMP_FILE

sqlc generate
