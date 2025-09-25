#!bin/sh
set -uo pipefail

output=`curl \
    --fail -s \
    -H "Content-Type: application/json" \
    -d "{\"personalAccessToken\":\"$NHOST_PAT\"}" \
    https://mytpiiwxeyrvlqrxuknp.auth.eu-central-1.nhost.run/v1/signin/pat`

if [ $? -ne 0 ]; then
    echo "Error: Failed to get access token"
    echo $output
    exit 1
fi

echo $output | jq -r '.session.accessToken'
