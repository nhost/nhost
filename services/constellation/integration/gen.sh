#!/bin/bash
set -euo pipefail

CLI=(go run ../../../cli/main.go)

ROLES=(admin user public)
HASURA_URL="https://local.hasura.local.nhost.run/v1/graphql"
NHOST_URL="http://localhost:8000/v1/graphql"
ADMIN_SECRET="nhost-admin-secret"

for role in "${ROLES[@]}"; do
    time "${CLI[@]}" schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${HASURA_URL}" -o "./schema.hasura.${role}.graphqls"

    time "${CLI[@]}" schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${NHOST_URL}" -o "./schema.nhost.${role}.graphqls"

    "${CLI[@]}" schema diff \
        -a "schema.hasura.${role}.graphqls" \
        -b "schema.nhost.${role}.graphqls" > "schema.${role}.diff"
done
