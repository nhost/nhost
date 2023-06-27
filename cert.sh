#!/bin/sh

set -euo pipefail

certbot certonly \
    -v \
    --dns-route53 \
    --dns-route53-propagation-seconds 60 \
    -d local.db.nhost.run \
    -d local.graphql.nhost.run \
    -d local.hasura.nhost.run \
    -d local.auth.nhost.run \
    -d local.storage.nhost.run \
    -d local.functions.nhost.run \
    -m 'admin@nhost.io' \
    --non-interactive \
    --agree-tos \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --logs-dir letsencrypt \
    --config-dir letsencrypt \
    --work-dir letsencrypt

cp letsencrypt/live/local.db.nhost.run/fullchain.pem internal/ssl/.ssl/
cp letsencrypt/live/local.db.nhost.run/privkey.pem internal/ssl/.ssl/

rm -rf letsencrypt
