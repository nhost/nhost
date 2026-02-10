#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Discovery & JWKS Demo
#
# Demonstrates OIDC Discovery (RFC 8414), JWKS retrieval, and offline JWT
# signature verification using openssl.
#
# Prerequisites:
#   - demo/grafana stack running (docker compose up + ./setup.sh)
#   - openssl installed
#   - jq installed
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

# Base64url decode (handles missing padding)
b64url_decode() {
    local input="$1"
    # Replace URL-safe chars and add padding
    local padded
    padded=$(echo -n "${input}" | tr '_-' '/+')
    local mod=$((${#padded} % 4))
    if [ "${mod}" -eq 2 ]; then padded="${padded}==";
    elif [ "${mod}" -eq 3 ]; then padded="${padded}="; fi
    echo -n "${padded}" | openssl base64 -d -A 2>/dev/null
}

# --- Preflight ---------------------------------------------------------------

echo ""
echo "  Discovery & JWKS Demo"
echo "  ====================="
echo ""

info "Checking auth service at ${AUTH_URL}..."
curl -sf "${AUTH_URL}/healthz" > /dev/null 2>&1 || fail "Auth service not reachable. Start the grafana demo stack first."
success "Auth service is healthy."

info "Checking for openssl..."
command -v openssl > /dev/null 2>&1 || fail "openssl is required for this demo"
success "openssl is available."

# --- Step 1: Fetch OIDC Discovery document ----------------------------------

step "Fetch OIDC Discovery document (/.well-known/openid-configuration)"

discovery_resp=$(curl -sf "${AUTH_URL}/.well-known/openid-configuration")

info "Discovery document:"
show "${discovery_resp}"
echo ""

issuer=$(echo "${discovery_resp}" | jq -r '.issuer')
jwks_uri=$(echo "${discovery_resp}" | jq -r '.jwks_uri')
token_endpoint=$(echo "${discovery_resp}" | jq -r '.token_endpoint')
authorization_endpoint=$(echo "${discovery_resp}" | jq -r '.authorization_endpoint')
userinfo_endpoint=$(echo "${discovery_resp}" | jq -r '.userinfo_endpoint')
introspection_endpoint=$(echo "${discovery_resp}" | jq -r '.introspection_endpoint // "not advertised"')
revocation_endpoint=$(echo "${discovery_resp}" | jq -r '.revocation_endpoint // "not advertised"')
registration_endpoint=$(echo "${discovery_resp}" | jq -r '.registration_endpoint // "not advertised"')

success "Discovery document fetched."
info "Key endpoints:"
info "  issuer:                  ${issuer}"
info "  authorization_endpoint:  ${authorization_endpoint}"
info "  token_endpoint:          ${token_endpoint}"
info "  userinfo_endpoint:       ${userinfo_endpoint}"
info "  jwks_uri:                ${jwks_uri}"
info "  introspection_endpoint:  ${introspection_endpoint}"
info "  revocation_endpoint:     ${revocation_endpoint}"
info "  registration_endpoint:   ${registration_endpoint}"

# --- Step 2: Fetch JWKS from discovered URI ----------------------------------

step "Fetch JWKS from discovered jwks_uri"

jwks_resp=$(curl -sf "${jwks_uri}")

info "JWKS response:"
show "${jwks_resp}"
echo ""

num_keys=$(echo "${jwks_resp}" | jq '.keys | length')
success "JWKS contains ${num_keys} key(s)."

# Extract the first RSA key
key_id=$(echo "${jwks_resp}" | jq -r '.keys[0].kid')
key_alg=$(echo "${jwks_resp}" | jq -r '.keys[0].alg')
key_kty=$(echo "${jwks_resp}" | jq -r '.keys[0].kty')
key_use=$(echo "${jwks_resp}" | jq -r '.keys[0].use')
info "First key: kid=${key_id}, alg=${key_alg}, kty=${key_kty}, use=${key_use}"

# --- Step 3: Obtain an access token via auth code flow -----------------------

step "Obtain an access token via authorization code flow"

# Register a client
register_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"client_name\": \"JWKS Verification Demo\",
        \"redirect_uris\": [\"${REDIRECT_URI}\"],
        \"scope\": \"openid profile email\",
        \"grant_types\": [\"authorization_code\"],
        \"response_types\": [\"code\"],
        \"token_endpoint_auth_method\": \"client_secret_post\"
    }")
client_id=$(echo "${register_resp}" | jq -r '.client_id')
client_secret=$(echo "${register_resp}" | jq -r '.client_secret')

# Sign in
signin_resp=$(curl -sf -X POST "${AUTH_URL}/signin/email-password" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${DEMO_EMAIL}\", \"password\": \"${DEMO_PASSWORD}\"}")
jwt=$(echo "${signin_resp}" | jq -r '.session.accessToken')

# Authorize
auth_resp=$(curl -s -o /dev/null -w '%{redirect_url}' \
    "${AUTH_URL}/oauth2/authorize?client_id=${client_id}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid+profile+email&state=jwks-demo")
request_id=$(echo "${auth_resp}" | grep -oE 'request_id=[^&]+' | cut -d= -f2)

# Consent
login_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/login" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${jwt}" \
    -d "{\"requestId\": \"${request_id}\"}")
redirect_uri=$(echo "${login_resp}" | jq -r '.redirectUri // .redirectTo // empty')
auth_code=$(echo "${redirect_uri}" | grep -oE 'code=[^&]+' | cut -d= -f2)

# Exchange
token_resp=$(curl -sf -X POST "${AUTH_URL}/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code&code=${auth_code}&redirect_uri=${REDIRECT_URI}&client_id=${client_id}&client_secret=${client_secret}")
access_token=$(echo "${token_resp}" | jq -r '.access_token')
[ -n "${access_token}" ] && [ "${access_token}" != "null" ] || fail "Token exchange failed: ${token_resp}"

success "Got access_token (first 50 chars): ${access_token:0:50}..."

# --- Step 4: Decode the JWT (no verification) --------------------------------

step "Decode the JWT header and payload (base64 decode, no verification)"

# Split the JWT
header_b64=$(echo "${access_token}" | cut -d. -f1)
payload_b64=$(echo "${access_token}" | cut -d. -f2)
signature_b64=$(echo "${access_token}" | cut -d. -f3)

header_json=$(b64url_decode "${header_b64}")
payload_json=$(b64url_decode "${payload_b64}")

info "JWT Header:"
show "${header_json}"
echo ""
info "JWT Payload:"
show "${payload_json}"
echo ""

jwt_kid=$(echo "${header_json}" | jq -r '.kid')
jwt_alg=$(echo "${header_json}" | jq -r '.alg')
jwt_iss=$(echo "${payload_json}" | jq -r '.iss')
jwt_sub=$(echo "${payload_json}" | jq -r '.sub')
jwt_exp=$(echo "${payload_json}" | jq -r '.exp')

success "JWT decoded: kid=${jwt_kid}, alg=${jwt_alg}, iss=${jwt_iss}, sub=${jwt_sub}"

# --- Step 5: Verify JWT signature using JWKS ---------------------------------

step "Verify the JWT signature using the JWKS public key"

info "Matching JWT kid (${jwt_kid}) against JWKS keys..."

# Find the matching key in JWKS
matching_key=$(echo "${jwks_resp}" | jq -r --arg kid "${jwt_kid}" '.keys[] | select(.kid == $kid)')
if [ -z "${matching_key}" ]; then
    info "No exact kid match found, using first key from JWKS..."
    matching_key=$(echo "${jwks_resp}" | jq -r '.keys[0]')
fi

info "Matched key: kid=$(echo "${matching_key}" | jq -r '.kid')"

# Extract RSA modulus (n) and exponent (e) from JWK
jwk_n=$(echo "${matching_key}" | jq -r '.n')
jwk_e=$(echo "${matching_key}" | jq -r '.e')

# Convert JWK to PEM using openssl
# Build the RSA public key from n and e components

# Decode modulus and exponent from base64url to hex
n_hex=$(b64url_decode "${jwk_n}" | xxd -p | tr -d '\n')
e_hex=$(b64url_decode "${jwk_e}" | xxd -p | tr -d '\n')

info "RSA modulus (first 40 hex chars): ${n_hex:0:40}..."
info "RSA exponent (hex): ${e_hex}"

# Build DER-encoded RSA public key
# ASN.1 INTEGER encoding helper
asn1_integer() {
    local hex="$1"
    # Add leading 00 if high bit is set (to ensure positive integer)
    if [ "$((16#${hex:0:1}))" -ge 8 ] 2>/dev/null || [[ "${hex:0:1}" =~ [89a-fA-F] ]]; then
        hex="00${hex}"
    fi
    local len=$((${#hex} / 2))
    if [ "${len}" -lt 128 ]; then
        printf '%02x%02x%s' 2 "${len}" "${hex}"
    elif [ "${len}" -lt 256 ]; then
        printf '%02x81%02x%s' 2 "${len}" "${hex}"
    else
        printf '%02x82%04x%s' 2 "${len}" "${hex}"
    fi
}

n_int=$(asn1_integer "${n_hex}")
e_int=$(asn1_integer "${e_hex}")

# RSA public key SEQUENCE
rsa_seq_content="${n_int}${e_int}"
rsa_seq_len=$((${#rsa_seq_content} / 2))
if [ "${rsa_seq_len}" -lt 128 ]; then
    rsa_sequence="30$(printf '%02x' "${rsa_seq_len}")${rsa_seq_content}"
elif [ "${rsa_seq_len}" -lt 256 ]; then
    rsa_sequence="3081$(printf '%02x' "${rsa_seq_len}")${rsa_seq_content}"
else
    rsa_sequence="3082$(printf '%04x' "${rsa_seq_len}")${rsa_seq_content}"
fi

# BIT STRING wrapping (prepend 00 for no unused bits)
bitstring_content="00${rsa_sequence}"
bitstring_len=$((${#bitstring_content} / 2))
if [ "${bitstring_len}" -lt 128 ]; then
    bitstring="03$(printf '%02x' "${bitstring_len}")${bitstring_content}"
elif [ "${bitstring_len}" -lt 256 ]; then
    bitstring="0381$(printf '%02x' "${bitstring_len}")${bitstring_content}"
else
    bitstring="0382$(printf '%04x' "${bitstring_len}")${bitstring_content}"
fi

# AlgorithmIdentifier for RSA: OID 1.2.840.113549.1.1.1 + NULL
alg_id="300d06092a864886f70d0101010500"

# Outer SEQUENCE: AlgorithmIdentifier + BIT STRING
outer_content="${alg_id}${bitstring}"
outer_len=$((${#outer_content} / 2))
if [ "${outer_len}" -lt 128 ]; then
    outer_sequence="30$(printf '%02x' "${outer_len}")${outer_content}"
elif [ "${outer_len}" -lt 256 ]; then
    outer_sequence="3081$(printf '%02x' "${outer_len}")${outer_content}"
else
    outer_sequence="3082$(printf '%04x' "${outer_len}")${outer_content}"
fi

# Convert to PEM
pem_body=$(echo -n "${outer_sequence}" | xxd -r -p | openssl base64 -A | fold -w 64)
pem="-----BEGIN PUBLIC KEY-----
${pem_body}
-----END PUBLIC KEY-----"

info "Constructed PEM public key from JWKS."

# Create temp files for verification
tmpdir=$(mktemp -d)
trap 'rm -rf "${tmpdir}"' EXIT

echo "${pem}" > "${tmpdir}/pubkey.pem"

# Verify the PEM key is valid
if openssl pkey -pubin -in "${tmpdir}/pubkey.pem" -noout 2>/dev/null; then
    success "PEM public key is valid."
else
    fail "Failed to construct valid PEM from JWKS. The key format may not be supported by this demo."
fi

# Prepare signature verification
# The signed content is: base64url(header).base64url(payload)
signed_content="${header_b64}.${payload_b64}"
echo -n "${signed_content}" > "${tmpdir}/signed_data"

# Decode the signature from base64url
b64url_decode "${signature_b64}" > "${tmpdir}/signature.bin"

# Determine the digest algorithm from JWT alg
case "${jwt_alg}" in
    RS256) digest="-sha256" ;;
    RS384) digest="-sha384" ;;
    RS512) digest="-sha512" ;;
    *)     fail "Unsupported JWT algorithm: ${jwt_alg}" ;;
esac

# Verify the signature
info "Verifying signature with openssl (algorithm: ${jwt_alg})..."
if openssl dgst "${digest}" -verify "${tmpdir}/pubkey.pem" -signature "${tmpdir}/signature.bin" "${tmpdir}/signed_data" 2>/dev/null; then
    success "JWT signature is VALID!"
else
    fail "JWT signature verification FAILED."
fi

# --- Step 6: Show the verified claims ----------------------------------------

step "Show the verified JWT claims"

info "The following claims have been cryptographically verified:"
echo ""
echo "${payload_json}" | jq .
echo ""

exp_date=""
if command -v date > /dev/null 2>&1; then
    if [ "$(uname)" = "Darwin" ]; then
        exp_date=$(date -r "${jwt_exp}" 2>/dev/null || echo "")
    else
        exp_date=$(date -d "@${jwt_exp}" 2>/dev/null || echo "")
    fi
fi

info "Issuer (iss):   ${jwt_iss}"
info "Subject (sub):  ${jwt_sub}"
info "Expires (exp):  ${jwt_exp}${exp_date:+ (${exp_date})}"
info "Algorithm:      ${jwt_alg}"
info "Key ID:         ${jwt_kid}"

# --- Done --------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  Demo complete!"
echo "============================================================"
echo ""
echo "  This demo showed:"
echo "    1. OIDC Discovery — fetching server metadata"
echo "    2. JWKS retrieval — getting public signing keys"
echo "    3. JWT decoding — inspecting header and payload"
echo "    4. Offline signature verification — using openssl"
echo "    5. Trust chain: Discovery -> JWKS -> JWT verification"
echo ""
