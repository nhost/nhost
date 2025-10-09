#!/bin/sh
#
pg_dump -s -n auth postgres://postgres:postgres@localhost:5432/local > auth_schema_dump.sql

sqlc generate
