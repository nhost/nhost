#!/bin/bash

jq -c '.[]' input.json | while read i; do

  id=$(jq '.id' -r <<< "$i")
  path=$(jq '.path' -r <<< "$i")

  curl \
    -X PUT \
    -H "Content-Type: multipart/form-data" \
    -H "x-hasura-admin-secret: nhost-admin-secret" \
    -F "file=@$path" \
    https://local.storage.nhost.run/v1/files/$id
done


echo "Done"