#!/bin/bash

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: admin" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.admin.graphqls \
    https://local.graphql.local.nhost.run/v1

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: user" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.user.graphqls \
    https://local.graphql.local.nhost.run/v1

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: public" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.public.graphqls \
    https://local.graphql.local.nhost.run/v1

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: admin" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.admin.graphqls \
    http://localhost:8000/graphql

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: user" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.user.graphqls \
    http://localhost:8000/graphql

time rover graph introspect \
    --skip-update-check \
    -H "X-Hasura-Role: public" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.public.graphqls \
    http://localhost:8000/graphql

go run ../main.go debug schema-diff \
    -a schema.hasura.admin.graphqls \
    -b schema.nhost.admin.graphqls > schema.admin.diff

go run ../main.go debug schema-diff \
    -a schema.hasura.user.graphqls \
    -b schema.nhost.user.graphqls > schema.user.diff

go run ../main.go debug schema-diff \
    -a schema.hasura.public.graphqls \
    -b schema.nhost.public.graphqls > schema.public.diff
