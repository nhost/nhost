#!/usr/bin/env bash

URL=http://localhost:8000/v1/files

# token can be generated using build/dev/jwt-gen
AUTH="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwNzc3NzY0NjYsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJhZG1pbiJdLCJ4LWhhc3VyYS1kZWZhdWx0LXJvbGUiOiJhZG1pbiIsIngtaGFzdXJhLXVzZXItaWQiOiJhYjViYTU4ZS05MzJhLTQwZGMtODdlOC03MzM5OTg3OTRlYzIiLCJ4LWhhc3VyYS11c2VyLWlzQW5vbnltb3VzIjoiZmFsc2UifSwiaWF0IjoxNzYyNDE2NDY2LCJpc3MiOiJoYXN1cmEtYXV0aCIsInN1YiI6ImFiNWJhNThlLTkzMmEtNDBkYy04N2U4LTczMzk5ODc5NGVjMiJ9.msexXYDRzox0giNGRHqPrefYH_uWXMtdCbEZ_Vg-IV8"
BUCKET=default

FILE_ID=55af1e60-0f28-454e-885e-ea6aab2bb288
ETAG=\"588be441fe7a59460850b0aa3e1c5a65\"

# we sleep for 1s to make sure a drift in the clocks between client/server doesn't
# lead to a JWTIssuedAtFuture error
sleep 1

output=`curl $URL \
  -v \
  -H "$AUTH" \
  -F "bucket-id=$BUCKET" \
  -F "metadata[]={\"id\":\"7982873d-8e89-4321-ab86-00f80a168c5a\", \"name\":\"config.yaml\",\"metadata\":{\"num\":123,\"list\":[1,2,3]}};type=application/json" \
  -F "file[]=@vacuum.yaml" \
  -F "metadata[]={\"id\":\"faa80d51-07c7-4268-942d-8f092c98c71a\", \"name\":\"docs.md\"};type=application/json" \
  -F "file[]=@README.md" \
  -F "metadata[]={\"id\":\"$FILE_ID\", \"name\":\"logo.jpg\"};type=application/json" \
  -F "file[]=@image/testdata/nhost.jpg"`

echo $output | jq

time curl -v -o nhost.jpg $URL/${FILE_ID} \
      -H "$AUTH"

time curl -v -o nhost.jpg $URL/${FILE_ID}?w=600\&h\=200\&q=50\&b=5 \
      -H "$AUTH"
