#!/bin/bash

curl \
  -X PUT \
  -H "Content-Type: multipart/form-data" \
  -H "x-hasura-admin-secret: nhost-admin-secret" \
  -F "file=@files/nhost-nextjs.png" \
  http://localhost:1337/v1/storage/files/3d62252d-8db2-4b2b-ba63-f2ef64af4267


# jq -c '.[]' input.json | while read i; do
#     # do stuff with $i
#     echo $i
#     original_name=$(jq '.id' -r <<< "$i")
#     asd="okeh"
#     echo $original_name
#     echo $asd
# done
