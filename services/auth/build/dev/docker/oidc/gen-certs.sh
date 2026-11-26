#!/usr/bin/env bash
# Regenerate the test-only TLS materials used by the isolated OIDC integration
# stack (Dex identity provider + HTTPS Auth instance).
#
# These certificates are TEST FIXTURES. They are committed so the integration
# tests are reproducible with no runtime certificate generation and no network
# access. They are never used in production.
#
# The static IPs must match the `subnet`/`ipv4_address` values in
# docker-compose.yaml. The hostnames are included so the same certificates work
# when the services are reached by Docker service name from inside the network.
#
# Usage: ./gen-certs.sh
set -euo pipefail

cd "$(dirname "$0")/certs"

DEX_IP="10.233.0.10"
AUTH_IP="10.233.0.11"
DAYS=3650 # test fixtures; long-lived to avoid churn

echo "➜ Generating test CA"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ca.key -out ca.crt -days "$DAYS" -sha256 \
  -subj "/CN=Nhost Auth OIDC Test CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign"

gen_leaf() {
  local name="$1" ip="$2" dns="$3"
  echo "➜ Generating leaf certificate for ${name} (${ip}, ${dns})"
  openssl req -newkey rsa:2048 -nodes \
    -keyout "${name}.key" -out "${name}.csr" -sha256 \
    -subj "/CN=${dns}"
  openssl x509 -req -in "${name}.csr" \
    -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out "${name}.crt" -days "$DAYS" -sha256 \
    -extfile <(printf 'subjectAltName=DNS:%s,DNS:localhost,IP:%s,IP:127.0.0.1\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$dns" "$ip")
  rm -f "${name}.csr"
}

gen_leaf dex "$DEX_IP" dex
gen_leaf auth "$AUTH_IP" auth-oidc

rm -f ca.srl
echo "✓ Test certificates written to $(pwd)"
