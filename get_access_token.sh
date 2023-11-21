#!bin/sh
set -euo pipefail

curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"personalAccessToken\":\"$NHOST_PAT\"}" \
    https://staging.nhost.run/v1/auth/signin/pat | jq -r '.session.accessToken'
