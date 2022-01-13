#!/usr/bin/bash

URL=http://localhost:8000/api/v1/files
AUTH="Authorization: Bearer $(make dev-jwt)"
BUCKET=default

FILE_ID=55af1e60-0f28-454e-885e-ea6aab2bb288
ETAG=\"588be441fe7a59460850b0aa3e1c5a65\"


output=`curl $URL/ \
  -v \
  -H "Content-Type: multipart/form-data" \
  -H "$AUTH" \
  -F "bucket-id=$BUCKET" \
  -F "metadata[]={\"id\":\"$FILE_ID\", \"name\":\"alphabet.txt\"};type=application/json" \
  -F "file[]=@tests/integration/alphabet.txt" \
  -F "metadata[]={\"id\":\"7982873d-8e89-4321-ab86-00f80a168c5a\", \"name\":\"config.yaml\"};type=application/json" \
  -F "file[]=@hasura-storage.yaml" \
  -F "metadata[]={\"id\":\"faa80d51-07c7-4268-942d-8f092c98c71a\", \"name\":\"docs.md\"};type=application/json" \
  -F "file[]=@README.md"`

echo $output | jq

echo "🟢 Give me file information"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" 

echo "🟢 Give me file information, etag matches"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "if-match: $ETAG"


echo "🟡 Give me file information, etag doesn't match"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "if-match: \"blah\""


echo "🟡 Don't give me file information, etag matches"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "if-none-match: $ETAG"


echo "🟢 Give me file information, etag doesn't match"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "if-none-match: \"blah\""


echo "🟡 Give me file information, NO new version available"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "If-Modified-Since: Thu, 23 Dec 2023 10:00:00 UTC"

echo "🟢 Give me file information, new version available"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "If-Modified-Since: Thu, 22 Dec 2020 10:00:00 UTC"

echo "🟡 Give me file information, hasn't been modified since I got it, no"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "If-Unmodified-Since: Thu, 23 Dec 2023 10:00:00 UTC"

echo "🟢 Give me file information, hasn't been modified since I got it, yes"
curl $URL/$FILE_ID \
  -s \
  --head \
  -H "$AUTH" \
  -H "If-Unmodified-Since: Thu, 22 Dec 2021 10:00:00 UTC"

echo "🟢 Get file"
curl $URL/$FILE_ID \
   --output /dev/null \
  -v \
  -H "$AUTH"

echo "🟢 Delete file"
curl $URL/$FILE_ID \
  -X DELETE \
  -v \
  -H "$AUTH"

echo "🟡 Get file, should get 404"
curl $URL/$FILE_ID \
  --output /dev/null \
  -v \
  -H "$AUTH"
