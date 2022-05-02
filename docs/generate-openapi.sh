#!/bin/bash
CWD=$(PWD)
cd ../examples/docker-compose
cp .env.example .env
export AUTH_CLIENT_URL="https://my-app.com"

docker-compose pull auth storage
docker-compose up -d

echo -n "Waiting for hasura-auth to be ready"
while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' http://localhost:1337/v1/auth/healthz)" != "200" ]]; 
do 
  echo -n "."
  sleep 1; 
done
echo 

cd $CWD
curl http://localhost:1337/v1/auth/openapi.json | jq '.' > static/openapi/hasura-auth.json

cd ../examples/docker-compose
docker-compose down
