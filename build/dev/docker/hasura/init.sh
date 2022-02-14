#!/bin/sh

# we wait to make sure postgres is really ready
sleep 3

graphql-engine serve &

# now to make sure graphql-engine is ready
sleep 10

### export metdata with:
# curl \
#     -H "X-Hasura-admin-secret: $HASURA_GRAPHQL_ADMIN_SECRET" \
#     -d'{"type": "export_metadata", "args": {}}' \
#     http://localhost:8080/v1/metadata \
#     -o hasura_metadata.json

curl \
    -H "X-Hasura-admin-secret: $HASURA_ADMIN_SECRET" \
    -d'{"type":"replace_metadata", "args":'$(cat hasura_metadata.json)'}' \
    http://localhost:8080/v1/metadata

sleep infinity
