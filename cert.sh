#!/bin/sh

set -euo pipefail

certbot certonly \
    -v \
    --dns-route53 \
    -d local.auth.nhost.run \
    -d local.dashboard.nhost.run \
    -d local.db.nhost.run \
    -d local.functions.nhost.run \
    -d local.graphql.nhost.run \
    -d local.hasura.nhost.run \
    -d local.mailhog.nhost.run \
    -d local.storage.nhost.run \
    -m 'admin@nhost.io' \
    --non-interactive \
    --agree-tos \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --logs-dir letsencrypt \
    --config-dir letsencrypt \
    --work-dir letsencrypt

cp letsencrypt/live/local.auth.nhost.run/fullchain.pem ssl/.ssl/
cp letsencrypt/live/local.auth.nhost.run/privkey.pem ssl/.ssl/

rm -rf letsencrypt
