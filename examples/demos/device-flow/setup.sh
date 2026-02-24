#!/usr/bin/env bash
set -euo pipefail

# ── Usage ─────────────────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "Usage: $0 <client_id>"
  echo ""
  echo "  Create an OAuth2 client in the Nhost Dashboard first, then"
  echo "  pass the client ID here. The client should have the scopes:"
  echo "  openid, profile, email, graphql"
  exit 1
fi

CLIENT_ID="$1"

# ── Configuration ─────────────────────────────────────────────────
AUTH_URL="${AUTH_URL:-https://local.auth.local.nhost.run/v1}"
GRAPHQL_URL="${GRAPHQL_URL:-https://local.graphql.local.nhost.run/v1}"

# ── Helpers ───────────────────────────────────────────────────────
die()  { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed."; }

need curl
need jq

echo ""
echo "============================================"
echo "  OAuth2 Device Flow Demo"
echo "============================================"
echo ""
echo "  Client ID: ${CLIENT_ID}"
echo ""

# ── Step 1: Request device authorization ──────────────────────────
echo "Requesting device authorization..."

DEVICE_RESPONSE=$(curl -s -X POST "${AUTH_URL}/oauth2/device" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}&scope=openid+profile+email+graphql")

DEVICE_CODE=$(echo "$DEVICE_RESPONSE" | jq -r '.device_code // empty')
USER_CODE=$(echo "$DEVICE_RESPONSE" | jq -r '.user_code // empty')
VERIFY_URI=$(echo "$DEVICE_RESPONSE" | jq -r '.verification_uri // empty')
VERIFY_URI_COMPLETE=$(echo "$DEVICE_RESPONSE" | jq -r '.verification_uri_complete // empty')
INTERVAL=$(echo "$DEVICE_RESPONSE" | jq -r '.interval // 5')
EXPIRES_IN=$(echo "$DEVICE_RESPONSE" | jq -r '.expires_in // 0')

if [ -z "$DEVICE_CODE" ] || [ -z "$USER_CODE" ]; then
  echo "Failed to start device flow. Response:"
  echo "$DEVICE_RESPONSE" | jq .
  die "Could not initiate device authorization."
fi

echo ""
echo "============================================"
echo "  Open this URL in your browser:"
echo ""
echo "    ${VERIFY_URI_COMPLETE}"
echo ""
echo "  Or go to: ${VERIFY_URI}"
echo "  and enter code: ${USER_CODE}"
echo ""
echo "  Expires in ${EXPIRES_IN} seconds."
echo "============================================"
echo ""

# ── Step 3: Poll for token ────────────────────────────────────────
echo "Waiting for authorization..."

while true; do
  sleep "$INTERVAL"

  TOKEN_RESPONSE=$(curl -s -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&device_code=${DEVICE_CODE}&client_id=${CLIENT_ID}")

  ERROR=$(echo "$TOKEN_RESPONSE" | jq -r '.error // empty')
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')

  case "$ERROR" in
    authorization_pending)
      printf "."
      ;;
    slow_down)
      INTERVAL=$((INTERVAL + 5))
      printf "."
      ;;
    access_denied)
      echo ""
      die "User denied the authorization request."
      ;;
    expired_token)
      echo ""
      die "Device code expired. Please run the script again."
      ;;
    "")
      if [ -n "$ACCESS_TOKEN" ]; then
        echo ""
        echo ""
        echo "Authorization successful!"
        break
      fi
      echo ""
      echo "Unexpected response:"
      echo "$TOKEN_RESPONSE" | jq .
      die "Unexpected token response."
      ;;
    *)
      echo ""
      echo "Error: $ERROR"
      echo "$TOKEN_RESPONSE" | jq .
      die "Token exchange failed."
      ;;
  esac
done

# ── Step 4: Display token info ────────────────────────────────────
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token // empty')
SCOPE=$(echo "$TOKEN_RESPONSE" | jq -r '.scope // empty')
EXPIRES_IN=$(echo "$TOKEN_RESPONSE" | jq -r '.expires_in // 0')
ID_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token // empty')

echo ""
echo "── Token Details ─────────────────────────"
echo "  Access Token:  ${ACCESS_TOKEN:0:40}..."
echo "  Refresh Token: ${REFRESH_TOKEN:0:20}..."
echo "  Scope:         ${SCOPE}"
echo "  Expires In:    ${EXPIRES_IN}s"
if [ -n "$ID_TOKEN" ]; then
  echo "  ID Token:      ${ID_TOKEN:0:40}..."
fi
echo ""

# ── Step 5: Fetch user info via GraphQL ───────────────────────────
# The access token contains Hasura-compatible claims (thanks to the
# "graphql" scope) so we can use it directly against the GraphQL API.
# Decode the JWT payload to extract the user ID (sub claim).
USER_ID=$(echo "$ACCESS_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq -r '.sub')

echo "── Fetching user info via GraphQL ────────"
echo "  User ID (from JWT sub): ${USER_ID}"
echo ""

USER_INFO=$(curl -s -X POST "${GRAPHQL_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d "$(jq -n --arg uid "$USER_ID" '{
    "query": "query GetUser($id: uuid!) { user(id: $id) { id displayName email emailVerified phoneNumber avatarUrl locale createdAt metadata } }",
    "variables": { "id": $uid }
  }')")

echo "$USER_INFO" | jq '.data.user // .errors'
echo ""
echo "Done!"
