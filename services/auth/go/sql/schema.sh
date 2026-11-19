#!/bin/sh
DUMP_FILE="auth_schema_dump.sql"

pg_dump -s -n auth postgres://postgres:postgres@localhost:5432/local > "$DUMP_FILE"

# Ignore version banners and random psql restriction keys, not schema content.
sed '/^-- Dumped from database version /d;/^-- Dumped by pg_dump version /d;/^\\restrict /d;/^\\unrestrict /d' "$DUMP_FILE" > "$DUMP_FILE.tmp" && mv "$DUMP_FILE.tmp" "$DUMP_FILE"

sqlc generate
