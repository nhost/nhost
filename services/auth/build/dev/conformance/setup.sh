#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AUTH_URL="http://localhost:4000"
HASURA_URL="http://localhost:18080"
HASURA_ADMIN_SECRET="nhost-admin-secret"
DEMO_EMAIL="demo@example.com"
DEMO_PASSWORD="Demo1234"
CONFORMANCE_REDIRECT="https://localhost.emobix.co.uk:8443/test/a/nhost/callback"
CONFORMANCE_SCOPES='["openid","profile","email","phone"]'

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

# Helper: create an OAuth2 client via Hasura GraphQL and return client_id.
# The client_secret is the plaintext; the bcrypt hash is computed here.
# Usage: create_client <label> <plaintext_secret>
create_client() {
    local label="$1"
    local secret="$2"
    local secret_hash

    # Hash secret with bcrypt using htpasswd (available in most systems)
    # Fall back to python3 if htpasswd is not available
    if command -v htpasswd > /dev/null 2>&1; then
        secret_hash=$(htpasswd -nbBC 10 "" "${secret}" | cut -d: -f2)
    else
        secret_hash=$(python3 -c "import bcrypt; print(bcrypt.hashpw('${secret}'.encode(), bcrypt.gensalt(10)).decode())")
    fi

    local resp
    resp=$(curl -sf -X POST "${HASURA_URL}/v1/graphql" \
        -H "Content-Type: application/json" \
        -H "x-hasura-admin-secret: ${HASURA_ADMIN_SECRET}" \
        -d "{
            \"query\": \"mutation (\$object: authOauth2Clients_insert_input!) { insertAuthOauth2Client(object: \$object) { clientId } }\",
            \"variables\": {
                \"object\": {
                    \"clientSecretHash\": \"${secret_hash}\",
                    \"redirectUris\": [\"${CONFORMANCE_REDIRECT}\"],
                    \"scopes\": ${CONFORMANCE_SCOPES}
                }
            }
        }")

    local client_id
    client_id=$(echo "${resp}" | grep -o '"clientId":"[^"]*"' | cut -d'"' -f4)

    if [ -z "${client_id}" ]; then
        echo "ERROR: Failed to create OAuth2 client (${label})."
        echo "Response: ${resp}"
        exit 1
    fi

    echo "${client_id}"
}

# Generate random secrets (two concatenated UUIDs, matching the server's format)
gen_secret() {
    python3 -c "import uuid; print(str(uuid.uuid4()) + str(uuid.uuid4()))"
}

client1_secret=$(gen_secret)
client2_secret=$(gen_secret)
client3_secret=$(gen_secret)

echo ""
echo "==> Creating OAuth2 client 1 (client_secret_basic)..."
client1_id=$(create_client "client1" "${client1_secret}")
echo "    Client 1 ID:     ${client1_id}"
echo "    Client 1 Secret: ${client1_secret}"

echo ""
echo "==> Creating OAuth2 client 2 (client_secret_post)..."
client2_id=$(create_client "client2" "${client2_secret}")
echo "    Client 2 ID:     ${client2_id}"
echo "    Client 2 Secret: ${client2_secret}"

echo ""
echo "==> Creating OAuth2 client 3 (second client, client_secret_basic)..."
client3_id=$(create_client "client3" "${client3_secret}")
echo "    Client 3 ID:     ${client3_id}"
echo "    Client 3 Secret: ${client3_secret}"

# Write test-config.json for static client plans (basic certification)
cat > "${SCRIPT_DIR}/test-config.json" <<EOF
{
  "alias": "nhost",
  "description": "Nhost Auth OIDC Basic Profile (static clients)",
  "server": {
    "discoveryUrl": "https://httpd:9443/.well-known/openid-configuration"
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
      "match": "https://httpd:9443/oauth2/authorize*",
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
echo "  Config files written:"
echo "    test-config.json — static clients (basic certification)"
echo ""
echo "  Test credentials:"
echo "    Email:    ${DEMO_EMAIL}"
echo "    Password: ${DEMO_PASSWORD}"
echo ""
