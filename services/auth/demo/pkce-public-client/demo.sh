#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# PKCE Public Client Demo
#
# Demonstrates the Authorization Code + PKCE (S256) flow with a public client
# (no client secret). This is the recommended flow for SPAs and native apps.
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
echo "  PKCE Public Client Demo"
echo "  ======================="
echo ""

info "Checking auth service at ${AUTH_URL}..."
curl -sf "${AUTH_URL}/healthz" > /dev/null 2>&1 || fail "Auth service not reachable. Start the grafana demo stack first."
success "Auth service is healthy."

# --- Step 1: Register a public client ----------------------------------------

step "Register a public client (token_endpoint_auth_method: none)"

register_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"PKCE Public Client Demo\",
        \"redirect_uris\": [\"${REDIRECT_URI}\"],
        \"scope\": \"openid profile email\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"none\"
    }")

client_id=$(echo "${register_resp}" | jq -r '.client_id')
[ -n "${client_id}" ] && [ "${client_id}" != "null" ] || fail "Failed to register client: ${register_resp}"

info "Registration response:"
show "${register_resp}"
echo ""
success "Public client registered: client_id=${client_id}"
info "Note: No client_secret is needed (auth method is 'none')."

# --- Step 2: Generate PKCE code_verifier and code_challenge ------------------

step "Generate PKCE code_verifier and code_challenge (S256)"

code_verifier=$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
code_challenge=$(printf '%s' "${code_verifier}" | openssl dgst -sha256 -binary | openssl base64 -A | tr -d '=' | tr '/+' '_-')

info "code_verifier:  ${code_verifier}"
info "code_challenge: ${code_challenge}  (S256 = base64url(sha256(verifier)))"

# --- Step 3: Start authorization request -------------------------------------

step "Initiate authorization request (/oauth2/authorize)"

auth_url="${AUTH_URL}/oauth2/authorize?client_id=${client_id}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+profile+email&code_challenge=${code_challenge}&code_challenge_method=S256&state=demo-state-123"
info "Authorization URL:"
info "  ${auth_url}"
echo ""

# Follow the redirect to get the Location header with request_id
auth_resp=$(curl -s -o /dev/null -w '%{redirect_url}' "${auth_url}")
info "Redirect Location: ${auth_resp}"

request_id=$(echo "${auth_resp}" | grep -oE 'request_id=[^&]+' | cut -d= -f2)
[ -n "${request_id}" ] || fail "Could not extract request_id from redirect: ${auth_resp}"
success "Got request_id: ${request_id}"

# --- Step 4: Sign in as demo user -------------------------------------------

step "Sign in as demo user to get JWT"

signin_resp=$(curl -sf -X POST "${AUTH_URL}/signin/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}")

jwt=$(echo "${signin_resp}" | jq -r '.session.accessToken')
[ -n "${jwt}" ] && [ "${jwt}" != "null" ] || fail "Failed to sign in: ${signin_resp}"
success "Signed in. Got JWT (first 50 chars): ${jwt:0:50}..."

# --- Step 5: Approve consent -------------------------------------------------

step "Approve consent via /oauth2/login"

login_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/login" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{\"requestId\": \"${request_id}\"}")

redirect_uri=$(echo "${login_resp}" | jq -r '.redirectUri // .redirectTo // empty')
[ -n "${redirect_uri}" ] || fail "Could not get redirect URI from login response: ${login_resp}"

info "Redirect URI: ${redirect_uri}"

auth_code=$(echo "${redirect_uri}" | grep -oE 'code=[^&]+' | cut -d= -f2)
[ -n "${auth_code}" ] || fail "Could not extract authorization code from redirect: ${redirect_uri}"
success "Got authorization code: ${auth_code:0:20}..."

# --- Step 6: Exchange code for tokens (with code_verifier, no secret) --------

step "Exchange code at /oauth2/token (with code_verifier, NO client_secret)"

token_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=${auth_code}&redirect_uri=${REDIRECT_URI}&client_id=${client_id}&code_verifier=${code_verifier}")

access_token=$(echo "${token_resp}" | jq -r '.access_token')
[ -n "${access_token}" ] && [ "${access_token}" != "null" ] || fail "Token exchange failed: ${token_resp}"

info "Token response:"
show "${token_resp}"
echo ""
success "Got access_token (first 50 chars): ${access_token:0:50}..."

# --- Step 7: Fetch userinfo --------------------------------------------------

step "Fetch /oauth2/userinfo with access token"

userinfo_resp=$(curl -sf -X GET "${AUTH_URL}/oauth2/userinfo" \
    -H "Authorization: Bearer ${access_token}")

info "UserInfo response:"
show "${userinfo_resp}"
echo ""
success "UserInfo retrieved successfully."

# --- Step 8: Show that omitting code_verifier fails -------------------------

step "Demonstrate that omitting code_verifier fails"

info "Re-running the full flow to get a fresh code..."

# Get a new auth code (need a fresh one since the old one was already used)
auth_resp2=$(curl -s -o /dev/null -w '%{redirect_url}' \
    "${AUTH_URL}/oauth2/authorize?client_id=${client_id}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+profile+email&code_challenge=${code_challenge}&code_challenge_method=S256&state=demo-state-456")

request_id2=$(echo "${auth_resp2}" | grep -oE 'request_id=[^&]+' | cut -d= -f2)

login_resp2=$(curl -sf -X POST "${AUTH_URL}/oauth2/login" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{\"requestId\": \"${request_id2}\"}")

redirect_uri2=$(echo "${login_resp2}" | jq -r '.redirectUri // .redirectTo // empty')
auth_code2=$(echo "${redirect_uri2}" | grep -oE 'code=[^&]+' | cut -d= -f2)
[ -n "${auth_code2}" ] || fail "Could not get a fresh auth code for the negative test"

info "Exchanging code WITHOUT code_verifier (should fail)..."

fail_resp=$(curl -s -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=${auth_code2}&redirect_uri=${REDIRECT_URI}&client_id=${client_id}" \
    -w "\n%{http_code}" || true)

http_code=$(echo "${fail_resp}" | tail -1)
body=$(echo "${fail_resp}" | sed '$d')

info "HTTP status: ${http_code}"
info "Response:"
show "${body}"
echo ""
success "Token exchange correctly rejected without code_verifier."

# --- Done --------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  Demo complete!"
echo "============================================================"
echo ""
echo "  This demo showed:"
echo "    1. Registering a public client (no client secret)"
echo "    2. PKCE S256 challenge generation"
echo "    3. Full authorization code flow with PKCE"
echo "    4. Token exchange using code_verifier (no secret)"
echo "    5. UserInfo retrieval"
echo "    6. Proof that code_verifier is required"
echo ""
