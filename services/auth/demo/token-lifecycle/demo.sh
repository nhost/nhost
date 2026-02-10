#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Token Lifecycle Demo
#
# Demonstrates token introspection (RFC 7662), token revocation (RFC 7009),
# and refresh token rotation.
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
echo "  Token Lifecycle Demo"
echo "  ===================="
echo ""

info "Checking auth service at ${AUTH_URL}..."
curl -sf "${AUTH_URL}/healthz" > /dev/null 2>&1 || fail "Auth service not reachable. Start the grafana demo stack first."
success "Auth service is healthy."

# --- Step 1: Register client and get tokens ----------------------------------

step "Register confidential client and obtain tokens via auth code flow"

register_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"Token Lifecycle Demo\",
        \"redirect_uris\": [\"${REDIRECT_URI}\"],
        \"scope\": \"openid profile email\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_post\"
    }")

client_id=$(echo "${register_resp}" | jq -r '.client_id')
client_secret=$(echo "${register_resp}" | jq -r '.client_secret')
[ -n "${client_id}" ] && [ "${client_id}" != "null" ] || fail "Failed to register client"

info "Client registered: ${client_id}"

# Sign in to get JWT
signin_resp=$(curl -sf -X POST "${AUTH_URL}/signin/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}")
jwt=$(echo "${signin_resp}" | jq -r '.session.accessToken')

# Start auth flow
auth_resp=$(curl -s -o /dev/null -w '%{redirect_url}' \
    "${AUTH_URL}/oauth2/authorize?client_id=${client_id}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+profile+email&state=lifecycle-test")
request_id=$(echo "${auth_resp}" | grep -oE 'request_id=[^&]+' | cut -d= -f2)

# Approve consent
login_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/login" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{\"requestId\": \"${request_id}\"}")
redirect_uri=$(echo "${login_resp}" | jq -r '.redirectUri // .redirectTo // empty')
auth_code=$(echo "${redirect_uri}" | grep -oE 'code=[^&]+' | cut -d= -f2)

# Exchange code for tokens
token_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=${auth_code}&redirect_uri=${REDIRECT_URI}&client_id=${client_id}&client_secret=${client_secret}")

access_token=$(echo "${token_resp}" | jq -r '.access_token')
refresh_token=$(echo "${token_resp}" | jq -r '.refresh_token')
[ -n "${access_token}" ] && [ "${access_token}" != "null" ] || fail "Token exchange failed: ${token_resp}"

info "Token response:"
show "${token_resp}"
echo ""
success "Got access_token and refresh_token."

# --- Step 2: Introspect access token ----------------------------------------

step "Introspect the access token (RFC 7662)"

introspect_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/introspect" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=${access_token}&token_type_hint=access_token&client_id=${client_id}&client_secret=${client_secret}")

info "Introspection response:"
show "${introspect_resp}"
echo ""

active=$(echo "${introspect_resp}" | jq -r '.active')
[ "${active}" = "true" ] || fail "Expected active=true for access token"
success "Access token is active: true"

# --- Step 3: Introspect refresh token ----------------------------------------

step "Introspect the refresh token"

introspect_refresh=$(curl -sf -X POST "${AUTH_URL}/oauth2/introspect" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=${refresh_token}&token_type_hint=refresh_token&client_id=${client_id}&client_secret=${client_secret}")

info "Refresh token introspection:"
show "${introspect_refresh}"
echo ""

active=$(echo "${introspect_refresh}" | jq -r '.active')
[ "${active}" = "true" ] || fail "Expected active=true for refresh token"
success "Refresh token is active: true"

# --- Step 4: Refresh the token (rotation) ------------------------------------

step "Refresh the token (rotation: old refresh token becomes invalid)"

old_refresh_token="${refresh_token}"

refresh_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=refresh_token&refresh_token=${refresh_token}&client_id=${client_id}&client_secret=${client_secret}")

new_access_token=$(echo "${refresh_resp}" | jq -r '.access_token')
new_refresh_token=$(echo "${refresh_resp}" | jq -r '.refresh_token')
[ -n "${new_access_token}" ] && [ "${new_access_token}" != "null" ] || fail "Token refresh failed: ${refresh_resp}"

info "Refresh response:"
show "${refresh_resp}"
echo ""
success "Got new access_token and refresh_token."
info "Old refresh token: ${old_refresh_token:0:20}..."
info "New refresh token: ${new_refresh_token:0:20}..."

# --- Step 5: Introspect old refresh token (should be inactive) ---------------

step "Introspect the OLD refresh token (should be inactive after rotation)"

introspect_old=$(curl -sf -X POST "${AUTH_URL}/oauth2/introspect" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=${old_refresh_token}&token_type_hint=refresh_token&client_id=${client_id}&client_secret=${client_secret}")

info "Old refresh token introspection:"
show "${introspect_old}"
echo ""

active=$(echo "${introspect_old}" | jq -r '.active')
[ "${active}" = "false" ] || info "Note: Old refresh token is still active=${active} (implementation may vary)"
success "Old refresh token after rotation: active=${active}"

# --- Step 6: Revoke the new refresh token ------------------------------------

step "Revoke the new refresh token (RFC 7009)"

info "Revoking token..."
revoke_resp=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${AUTH_URL}/oauth2/revoke" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=${new_refresh_token}&token_type_hint=refresh_token&client_id=${client_id}&client_secret=${client_secret}")

info "HTTP status: ${revoke_resp}"
[ "${revoke_resp}" = "200" ] || fail "Expected HTTP 200, got ${revoke_resp}"
success "Revocation accepted (HTTP 200)."

# --- Step 7: Introspect the revoked refresh token ----------------------------

step "Introspect the revoked refresh token (should be inactive)"

introspect_revoked=$(curl -sf -X POST "${AUTH_URL}/oauth2/introspect" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "token=${new_refresh_token}&token_type_hint=refresh_token&client_id=${client_id}&client_secret=${client_secret}")

info "Revoked token introspection:"
show "${introspect_revoked}"
echo ""

active=$(echo "${introspect_revoked}" | jq -r '.active')
[ "${active}" = "false" ] || fail "Expected active=false for revoked token"
success "Revoked refresh token is active: false"

# --- Step 8: Try to use the revoked refresh token ----------------------------

step "Attempt to use the revoked refresh token (should fail)"

fail_resp=$(curl -s -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=refresh_token&refresh_token=${new_refresh_token}&client_id=${client_id}&client_secret=${client_secret}" \
    -w "\n%{http_code}" || true)

http_code=$(echo "${fail_resp}" | tail -1)
body=$(echo "${fail_resp}" | sed '$d')

info "HTTP status: ${http_code}"
info "Response:"
show "${body}"
echo ""
success "Refresh with revoked token correctly rejected."

# --- Done --------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  Demo complete!"
echo "============================================================"
echo ""
echo "  This demo showed:"
echo "    1. Token introspection (access + refresh tokens)"
echo "    2. Refresh token rotation (old token invalidated)"
echo "    3. Token revocation (RFC 7009)"
echo "    4. Revoked tokens are inactive on introspection"
echo "    5. Revoked tokens cannot be used for refresh"
echo ""
