#!/usr/bin/env bash
set -euo pipefail

AUTH_URL="https://local.auth.local.nhost.run/v1"
DEMO_NAME="Nhost User"
DEMO_EMAIL="user1@nhost.local"
DEMO_PASSWORD="Demo1234!"

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
signup_resp=$(curl -s -X POST "${AUTH_URL}/signup/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\", \"options\": {\"displayName\":\"${DEMO_NAME}\"}}" 2>&1) || true

if echo "${signup_resp}" | grep -q '"session"'; then
    echo "    User created successfully."
elif echo "${signup_resp}" | grep -qi 'already'; then
    echo "    User already exists, skipping."
else
    echo "    Signup response: ${signup_resp}"
    echo "    (Continuing anyway — user may already exist)"
fi

echo ""
echo "==> Signing in to get access token..."
signin_resp=$(curl -s -X POST "${AUTH_URL}/signin/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}" 2>&1) || true

access_token=$(echo "${signin_resp}" | grep -o '"accessToken":"[^"]*"' | head -1 | cut -d'"' -f4) || true

if [ -z "${access_token}" ]; then
    echo "ERROR: Failed to sign in. Cannot register OAuth2 client without a token."
    echo "Response: ${signin_resp}"
    exit 1
fi
echo "    Signed in successfully."

echo ""
echo "==> Registering OAuth2 client for Outline..."
register_resp=$(curl -s -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${access_token}" \
    -d '{
        "client_name": "Outline",
        "redirect_uris": ["http://localhost:3000/auth/oidc.callback"],
        "scope": "openid profile email",
        "grant_types": ["authorization_code"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post"
    }') || true

client_id=$(echo "${register_resp}" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4) || true
client_secret=$(echo "${register_resp}" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4) || true

if [ -z "${client_id}" ] || [ -z "${client_secret}" ]; then
    echo "ERROR: Failed to register OAuth2 client."
    echo "Response: ${register_resp}"
    exit 1
fi

echo "    Client registered successfully."
echo ""
echo "    Client ID:     ${client_id}"
echo "    Client Secret:  ${client_secret}"

# Generate secrets for Outline
secret_key=$(openssl rand -hex 32)
utils_secret=$(openssl rand -hex 32)

# Write .env file for Outline
cat > "$(dirname "$0")/.env" <<EOF
OAUTH2_CLIENT_ID=${client_id}
OAUTH2_CLIENT_SECRET=${client_secret}
SECRET_KEY=${secret_key}
UTILS_SECRET=${utils_secret}
EOF

echo ""
echo "==> .env file written with client credentials and secrets."
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Now start Outline:"
echo "    cd $(dirname "$0")"
echo "    docker compose up -d outline"
echo ""
echo "  Then open http://localhost:3001 and click"
echo "  'Continue with Nhost' to test the flow."
echo ""
echo "  Test credentials:"
echo "    Email:    ${DEMO_EMAIL}"
echo "    Password: ${DEMO_PASSWORD}"
echo ""
