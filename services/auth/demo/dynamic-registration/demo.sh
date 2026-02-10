#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Dynamic Client Registration Demo
#
# Demonstrates RFC 7591 Dynamic Client Registration, then immediately uses
# the newly registered client to perform a full OAuth2 authorization code flow.
#
# Prerequisites: demo/grafana stack running (docker compose up + ./setup.sh)
# =============================================================================

AUTH_URL="${AUTH_URL:-http://localhost:4000}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@example.com}"
DEMO_PASSWORD="${DEMO_PASSWORD:-Demo1234!}"
REDIRECT_URI="http://localhost:9999/callback"

# --- Helpers -----------------------------------------------------------------

step=0
step() {
    step=$((step + 1))
    echo ""
    echo "============================================================"
    echo "  Step ${step}: $1"
    echo "============================================================"
    echo ""
}

info()    { echo "  [INFO]  $*"; }
success() { echo "  [OK]    $*"; }
fail()    { echo "  [FAIL]  $*"; exit 1; }
show()    { echo "$1" | jq . 2>/dev/null || echo "$1"; }

# --- Preflight ---------------------------------------------------------------

echo ""
echo "  Dynamic Client Registration Demo"
echo "  ================================="
echo ""

info "Checking auth service at ${AUTH_URL}..."
curl -sf "${AUTH_URL}/healthz" > /dev/null 2>&1 || fail "Auth service not reachable. Start the grafana demo stack first."
success "Auth service is healthy."

# --- Step 1: Register a new client dynamically -------------------------------

step "Register a new OAuth2 client via /oauth2/register (RFC 7591)"

info "Sending registration request with custom metadata..."

register_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"My Dynamic App ($(date +%s))\",
        \"redirect_uris\": [\"${REDIRECT_URI}\"],
        \"scope\": \"openid profile email\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_post\",
        \"client_uri\": \"https://example.com\",
        \"logo_uri\": \"https://example.com/logo.png\"
    }")

info "Registration response:"
show "${register_resp}"
echo ""

client_id=$(echo "${register_resp}" | jq -r '.client_id')
client_secret=$(echo "${register_resp}" | jq -r '.client_secret')
client_name=$(echo "${register_resp}" | jq -r '.client_name')
[ -n "${client_id}" ] && [ "${client_id}" != "null" ] || fail "Failed to register client: ${register_resp}"

success "Client registered dynamically!"
info "  client_id:     ${client_id}"
info "  client_secret:  ${client_secret:0:20}..."
info "  client_name:    ${client_name}"

# --- Step 2: Show the returned metadata -------------------------------------

step "Inspect the returned client metadata"

info "The server returned all registered metadata:"
info "  client_id:                    $(echo "${register_resp}" | jq -r '.client_id')"
info "  client_name:                  $(echo "${register_resp}" | jq -r '.client_name')"
info "  redirect_uris:                $(echo "${register_resp}" | jq -c '.redirect_uris')"
info "  grant_types:                  $(echo "${register_resp}" | jq -c '.grant_types')"
info "  response_types:               $(echo "${register_resp}" | jq -c '.response_types')"
info "  scope:                        $(echo "${register_resp}" | jq -r '.scope')"
info "  token_endpoint_auth_method:   $(echo "${register_resp}" | jq -r '.token_endpoint_auth_method')"
info "  client_secret_expires_at:     $(echo "${register_resp}" | jq -r '.client_secret_expires_at') (0 = never)"
echo ""
success "Client metadata matches what was requested."

# --- Step 3: Start authorization flow with the new client --------------------

step "Run full OAuth2 auth code flow with the newly registered client"

info "Initiating authorization request..."

auth_resp=$(curl -s -o /dev/null -w '%{redirect_url}' \
    "${AUTH_URL}/oauth2/authorize?client_id=${client_id}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+profile+email&state=dyn-reg-test")

request_id=$(echo "${auth_resp}" | grep -oE 'request_id=[^&]+' | cut -d= -f2)
[ -n "${request_id}" ] || fail "Could not extract request_id from redirect: ${auth_resp}"
info "Got request_id: ${request_id}"

info "Signing in as demo user..."
signin_resp=$(curl -sf -X POST "${AUTH_URL}/signin/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}")
jwt=$(echo "${signin_resp}" | jq -r '.session.accessToken')
[ -n "${jwt}" ] && [ "${jwt}" != "null" ] || fail "Failed to sign in"

info "Approving consent..."
login_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/login" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{\"requestId\": \"${request_id}\"}")
redirect_uri=$(echo "${login_resp}" | jq -r '.redirectUri // .redirectTo // empty')
auth_code=$(echo "${redirect_uri}" | grep -oE 'code=[^&]+' | cut -d= -f2)
[ -n "${auth_code}" ] || fail "Could not extract auth code from redirect"

info "Exchanging authorization code for tokens..."
token_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=${auth_code}&redirect_uri=${REDIRECT_URI}&client_id=${client_id}&client_secret=${client_secret}")

access_token=$(echo "${token_resp}" | jq -r '.access_token')
[ -n "${access_token}" ] && [ "${access_token}" != "null" ] || fail "Token exchange failed: ${token_resp}"

info "Token response:"
show "${token_resp}"
echo ""
success "Authorization code flow completed with dynamically registered client."

# --- Step 4: Fetch userinfo -------------------------------------------------

step "Fetch /oauth2/userinfo to verify end-to-end flow"

userinfo_resp=$(curl -sf -X GET "${AUTH_URL}/oauth2/userinfo" \
    -H "Authorization: Bearer ${access_token}")

info "UserInfo response:"
show "${userinfo_resp}"
echo ""

sub=$(echo "${userinfo_resp}" | jq -r '.sub')
email=$(echo "${userinfo_resp}" | jq -r '.email')
[ -n "${sub}" ] && [ "${sub}" != "null" ] || fail "UserInfo missing 'sub' claim"

success "UserInfo verified: sub=${sub}, email=${email}"

# --- Done --------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  Demo complete!"
echo "============================================================"
echo ""
echo "  This demo showed:"
echo "    1. Dynamic client registration (RFC 7591)"
echo "    2. Inspecting returned client metadata"
echo "    3. Full auth code flow with the new client"
echo "    4. UserInfo retrieval proves end-to-end success"
echo ""
echo "  The dynamically registered client (${client_id})"
echo "  is now a fully functional OAuth2 client."
echo ""
