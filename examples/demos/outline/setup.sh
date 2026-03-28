#!/usr/bin/env bash
set -euo pipefail

client_id=$1
client_secret=$2

# Generate secrets for Outline
secret_key=$(openssl rand -hex 32)
utils_secret=$(openssl rand -hex 32)

SECRETS_FILE="$(cd "$(dirname "$0")/../backend" && pwd)/.secrets"

# Append Outline secrets to the backend .secrets file
cat >> "${SECRETS_FILE}" <<EOF

# Outline
OUTLINE_SECRET_KEY='${secret_key}'
OUTLINE_UTILS_SECRET='${utils_secret}'
OUTLINE_OIDC_CLIENT_ID='${client_id}'
OUTLINE_OIDC_CLIENT_SECRET='${client_secret}'
EOF

echo ""
echo "==> Outline secrets appended to ${SECRETS_FILE}"
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  Now restart the backend with the run services:"
echo "    cd ../backend"
echo "    nhost up --run-service ../outline/redis.toml --run-service ../outline/outline.toml"
echo ""
echo "  Then open http://localhost:3000 and click"
echo "  'Continue with Nhost' to test the flow."
echo ""
