#!/usr/bin/env bash

URL=http://localhost:8000/v1/files
AUTH="Authorization: Bearer $(make dev-jwt)"
BUCKET=default

FILE_ID=55af1e60-0f28-454e-885e-ea6aab2bb288
ETAG=\"588be441fe7a59460850b0aa3e1c5a65\"

# we sleep for 1s to make sure a drift in the clocks between client/server doesn't
# lead to a JWTIssuedAtFuture error
sleep 1

output=`curl $URL/ \
  -v \
  -H "$AUTH" \
  -F "bucket-id=$BUCKET" \
  -F "metadata[]={};type=application/json" \
  -F "file[]=@go.mod" \
  -F "metadata[]={\"id\":\"7982873d-8e89-4321-ab86-00f80a168c5a\", \"name\":\"config.yaml\",\"metadata\":{\"num\":123,\"list\":[1,2,3]}};type=application/json" \
  -F "file[]=@hasura-storage.yaml" \
  -F "metadata[]={\"id\":\"faa80d51-07c7-4268-942d-8f092c98c71a\", \"name\":\"docs.md\"};type=application/json" \
  -F "file[]=@README.md" \
  -F "metadata[]={\"id\":\"$FILE_ID\", \"name\":\"logo.jpg\"};type=application/json" \
  -F "file[]=@image/testdata/nhost.jpg"`

echo $output | jq

time curl -v -o nhost.jpg $URL/${FILE_ID} \
      -H "$AUTH"

time curl -v -o nhost.jpg $URL/${FILE_ID}?w=600\&h\=200\&q=50\&b=5 \
      -H "$AUTH"
