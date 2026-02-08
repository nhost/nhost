#!/usr/bin/env bash
set -euo pipefail

AUTH_URL="http://localhost:4000"
DEMO_EMAIL="demo@example.com"
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
echo "==> Registering OAuth2 client for Grafana..."
register_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d '{
        "client_name": "Grafana",
        "redirect_uris": ["http://localhost:3001/login/generic_oauth"],
        "scope": "openid profile email",
        "grant_types": ["authorization_code"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post"
    }')

client_id=$(echo "${register_resp}" | grep -o '"client_id":"[^"]*"' | cut -d'"' -f4)
client_secret=$(echo "${register_resp}" | grep -o '"client_secret":"[^"]*"' | cut -d'"' -f4)

if [ -z "${client_id}" ] || [ -z "${client_secret}" ]; then
    echo "ERROR: Failed to register OAuth2 client."
    echo "Response: ${register_resp}"
    exit 1
fi

echo "    Client registered successfully."
echo ""
echo "    Client ID:     ${client_id}"
echo "    Client Secret:  ${client_secret}"

# Write .env file for Grafana
cat > "$(dirname "$0")/.env" <<EOF
OAUTH2_CLIENT_ID=${client_id}
OAUTH2_CLIENT_SECRET=${client_secret}
EOF

echo ""
echo "==> .env file written with client credentials."
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Now start Grafana:"
echo "    cd $(dirname "$0")"
echo "    docker compose up -d grafana"
echo ""
echo "  Then open http://localhost:3001 and click"
echo "  'Sign in with Nhost' to test the flow."
echo ""
echo "  Test credentials:"
echo "    Email:    ${DEMO_EMAIL}"
echo "    Password: ${DEMO_PASSWORD}"
echo ""
