#!bin/sh
set -uo pipefail

output=`curl \
    --fail -s \
    -H "Content-Type: application/json" \
    -d "{\"personalAccessToken\":\"$NHOST_PAT\"}" \
    https://staging.nhost.run/v1/auth/signin/pat`

if [ $? -ne 0 ]; then
    echo "Error: Failed to get access token"
    echo $output
    exit 1
fi

echo $output | jq -r '.session.accessToken'
