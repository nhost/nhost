#1/bin/sh
cd $(dirname $0)

JWT_SECRET=$(docker exec hasura-storage-graphql bash -c 'echo "$HASURA_GRAPHQL_JWT_SECRET"')

go run main.go -jwt-secret "$JWT_SECRET"
