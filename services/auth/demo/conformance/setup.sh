#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTH_URL="http://localhost:4000"
DEMO_EMAIL="demo@example.com"
DEMO_PASSWORD="Demo1234!"
CONFORMANCE_REDIRECT="https://localhost.emobix.co.uk:8443/test/a/nhost/callback"
CONFORMANCE_SCOPES="openid profile email phone"

echo "==> Waiting for Auth service to be healthy..."
for i in $(seq 1 60); do
    if curl -sf "${AUTH_URL}/healthz" > /dev/null 2>&1; then
        echo "    Auth service is ready."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERROR: Auth service did not become healthy within 60 seconds."
        exit 1
    fi
    sleep 2
done

echo ""
echo "==> Creating test user (${DEMO_EMAIL})..."
signup_resp=$(curl -sf -X POST "${AUTH_URL}/signup/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}" 2>&1) || true

if echo "${signup_resp}" | grep -q '"session"'; then
    echo "    User created successfully."
elif echo "${signup_resp}" | grep -qi 'already'; then
    echo "    User already exists, skipping."
else
    echo "    Signup response: ${signup_resp}"
    echo "    (Continuing anyway — user may already exist)"
fi

echo ""
echo "==> Registering OAuth2 client 1 (client_secret_basic)..."
client1_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"Conformance Client 1 (basic)\",
        \"redirect_uris\": [\"${CONFORMANCE_REDIRECT}\"],
        \"scope\": \"${CONFORMANCE_SCOPES}\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_basic\"
    }")

client1_id=$(echo "${client1_resp}" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
client1_secret=$(echo "${client1_resp}" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)

if [ -z "${client1_id}" ] || [ -z "${client1_secret}" ]; then
    echo "ERROR: Failed to register OAuth2 client 1."
    echo "Response: ${client1_resp}"
    exit 1
fi
echo "    Client 1 ID:     ${client1_id}"
echo "    Client 1 Secret: ${client1_secret}"

echo ""
echo "==> Registering OAuth2 client 2 (client_secret_post)..."
client2_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"Conformance Client 2 (post)\",
        \"redirect_uris\": [\"${CONFORMANCE_REDIRECT}\"],
        \"scope\": \"${CONFORMANCE_SCOPES}\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_post\"
    }")

client2_id=$(echo "${client2_resp}" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
client2_secret=$(echo "${client2_resp}" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)

if [ -z "${client2_id}" ] || [ -z "${client2_secret}" ]; then
    echo "ERROR: Failed to register OAuth2 client 2."
    echo "Response: ${client2_resp}"
    exit 1
fi
echo "    Client 2 ID:     ${client2_id}"
echo "    Client 2 Secret: ${client2_secret}"

echo ""
echo "==> Registering OAuth2 client 3 (second client, client_secret_basic)..."
client3_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"Conformance Client 3 (second)\",
        \"redirect_uris\": [\"${CONFORMANCE_REDIRECT}\"],
        \"scope\": \"${CONFORMANCE_SCOPES}\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_basic\"
    }")

client3_id=$(echo "${client3_resp}" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
client3_secret=$(echo "${client3_resp}" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)

if [ -z "${client3_id}" ] || [ -z "${client3_secret}" ]; then
    echo "ERROR: Failed to register OAuth2 client 3."
    echo "Response: ${client3_resp}"
    exit 1
fi
echo "    Client 3 ID:     ${client3_id}"
echo "    Client 3 Secret: ${client3_secret}"

# Write test-config.json for run-test-plan.py
cat > "${SCRIPT_DIR}/test-config.json" <<EOF
{
  "alias": "nhost",
  "description": "Nhost Auth OIDC Basic Profile",
  "server": {
    "discoveryUrl": "http://auth:4000/.well-known/openid-configuration"
  },
  "client": {
    "client_id": "${client1_id}",
    "client_secret": "${client1_secret}"
  },
  "client2": {
    "client_id": "${client2_id}",
    "client_secret": "${client2_secret}"
  },
  "client_secret_post": {
    "client_id": "${client2_id}",
    "client_secret": "${client2_secret}"
  },
  "second_client": {
    "client_id": "${client3_id}",
    "client_secret": "${client3_secret}"
  },
  "browser": [
    {
      "match": "http://auth:4000/oauth2/authorize*",
      "tasks": [
        {
          "task": "Verify Complete",
          "match": "https://localhost.emobix.co.uk:8443/*",
          "commands": [
            ["wait", "id", "submission_complete", 10, ".*", "update-image-placeholder-optional"]
          ]
        }
      ]
    }
  ]
}
EOF

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  test-config.json written with client credentials."
echo ""
echo "  Test credentials:"
echo "    Email:    ${DEMO_EMAIL}"
echo "    Password: ${DEMO_PASSWORD}"
echo ""
