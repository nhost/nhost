#1/bin/sh
cd $(dirname $0)

JWT_SECRET=$(docker exec graphql-engine bash -c 'echo "$HASURA_GRAPHQL_JWT_SECRET"')

./jwt-gen.`uname` -jwt-secret "$JWT_SECRET"
