#!/bin/sh

set -euo pipefail

# read URLs from env variables (with defaults)
NEXT_PUBLIC_NHOST_ADMIN_SECRET="${NEXT_PUBLIC_NHOST_ADMIN_SECRET:-nhost-admin-secret}"
NEXT_PUBLIC_NHOST_AUTH_URL="${NEXT_PUBLIC_NHOST_AUTH_URL:-http://localhost:1337/v1/auth}"
NEXT_PUBLIC_NHOST_FUNCTIONS_URL="${NEXT_PUBLIC_NHOST_FUNCTIONS_URL:-http://localhost:1337/v1/functions}"
NEXT_PUBLIC_NHOST_GRAPHQL_URL="${NEXT_PUBLIC_NHOST_GRAPHQL_URL:-http://localhost:1337/v1/graphql}"
NEXT_PUBLIC_NHOST_STORAGE_URL="${NEXT_PUBLIC_NHOST_STORAGE_URL:-http://localhost:1337/v1/storage}"
NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL="${NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL:-http://localhost:9695}"
NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL="${NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL:-http://localhost:9693}"
NEXT_PUBLIC_NHOST_HASURA_API_URL="${NEXT_PUBLIC_NHOST_HASURA_API_URL:-http://localhost:8080}"

# replace placeholders
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_ADMIN_SECRET__~${NEXT_PUBLIC_NHOST_ADMIN_SECRET}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_AUTH_URL__~${NEXT_PUBLIC_NHOST_AUTH_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_FUNCTIONS_URL__~${NEXT_PUBLIC_NHOST_FUNCTIONS_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_GRAPHQL_URL__~${NEXT_PUBLIC_NHOST_GRAPHQL_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_STORAGE_URL__~${NEXT_PUBLIC_NHOST_STORAGE_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL__~${NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL__~${NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_HASURA_API_URL__~${NEXT_PUBLIC_NHOST_HASURA_API_URL}~g" {} +
find dashboard -type f -exec sed -i "s~__NEXT_PUBLIC_NHOST_CONFIGSERVER_URL__~${NEXT_PUBLIC_NHOST_CONFIGSERVER_URL}~g" {} +

exec "$@"
