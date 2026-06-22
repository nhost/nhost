#!/bin/sh

set -euo pipefail

certbot certonly \
    -v \
    --dns-route53 \
    -d local.ai.nhost.run \
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

cp letsencrypt/live/local.ai.nhost.run/fullchain.pem ssl/.ssl/local-fullchain.pem
cp letsencrypt/live/local.ai.nhost.run/privkey.pem ssl/.ssl/local-privkey.pem

certbot certonly \
    -v \
    --manual \
    --preferred-challenges dns \
    -d *.ai.local.nhost.run \
    -d *.auth.local.nhost.run \
    -d *.dashboard.local.nhost.run \
    -d *.db.local.nhost.run \
    -d *.functions.local.nhost.run \
    -d *.graphql.local.nhost.run \
    -d *.hasura.local.nhost.run \
    -d *.mailhog.local.nhost.run \
    -d *.storage.local.nhost.run \
    -m 'admin@nhost.io' \
    --agree-tos \
    --server https://acme-v02.api.letsencrypt.org/directory \
    --logs-dir letsencrypt \
    --config-dir letsencrypt \
    --work-dir letsencrypt

cp letsencrypt/live/ai.local.nhost.run/fullchain.pem ssl/.ssl/sub-fullchain.pem
cp letsencrypt/live/ai.local.nhost.run/privkey.pem ssl/.ssl/sub-privkey.pem

rm -rf letsencrypt
