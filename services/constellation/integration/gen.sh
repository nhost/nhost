#!/bin/bash

time go run ../main.go schema dump \
    -H "X-Hasura-Role: admin" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.admin.graphqls \
    -u https://local.graphql.local.nhost.run/v1

time go run ../main.go schema dump \
    -H "X-Hasura-Role: user" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.user.graphqls \
    -u https://local.graphql.local.nhost.run/v1

time go run ../main.go schema dump \
    -H "X-Hasura-Role: public" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.hasura.public.graphqls \
    -u https://local.graphql.local.nhost.run/v1

time go run ../main.go schema dump \
    -H "X-Hasura-Role: admin" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.admin.graphqls \
    -u http://localhost:8000/v1/graphql

time go run ../main.go schema dump \
    -H "X-Hasura-Role: user" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.user.graphqls \
    -u http://localhost:8000/v1/graphql

time go run ../main.go schema dump \
    -H "X-Hasura-Role: public" \
    -H "X-Hasura-Admin-Secret: nhost-admin-secret" \
    -o ./schema.nhost.public.graphqls \
    -u http://localhost:8000/v1/graphql

go run ../main.go schema diff \
    -a schema.hasura.admin.graphqls \
    -b schema.nhost.admin.graphqls > schema.admin.diff

go run ../main.go schema diff \
    -a schema.hasura.user.graphqls \
    -b schema.nhost.user.graphqls > schema.user.diff

go run ../main.go schema diff \
    -a schema.hasura.public.graphqls \
    -b schema.nhost.public.graphqls > schema.public.diff
