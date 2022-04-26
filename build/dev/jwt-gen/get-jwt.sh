#1/bin/sh
cd $(dirname $0)

JWT_SECRET=$(docker exec docker_graphql-engine_1 bash -c 'echo "$HASURA_GRAPHQL_JWT_SECRET"')

./jwt-gen.`uname`.`uname -m` -jwt-secret "$JWT_SECRET"
