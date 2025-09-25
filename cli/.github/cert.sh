#!/bin/bash

set -euo pipefail

mkdir -p /tmp/letsencrypt

echo "Generating SSL certificate for hostnames: local.nhost.run, local.graphql.nhost.run, local.auth.nhost.run, local.storage.nhost.run, local.functions.nhost.run, local.mail.nhost.run"
docker run --rm \
  --name certbot \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_REGION \
  -v /tmp/letsencrypt:/etc/letsencrypt \
  -v /tmp/letsencrypt:/var/lib/letsencrypt \
  certbot/dns-route53 certonly --dns-route53 --dns-route53-propagation-seconds 60 \
    -d local.auth.nhost.run \
    -d local.dashboard.nhost.run \
    -d local.db.nhost.run \
    -d local.functions.nhost.run \
    -d local.graphql.nhost.run \
    -d local.hasura.nhost.run \
    -d local.mailhog.nhost.run \
    -d local.storage.nhost.run \
    -d *.auth.local.nhost.run \
    -d *.dashboard.local.nhost.run \
    -d *.db.local.nhost.run \
    -d *.functions.local.nhost.run \
    -d *.graphql.local.nhost.run \
    -d *.hasura.local.nhost.run \
    -d *.mailhog.local.nhost.run \
    -d *.storage.local.nhost.run \
    -m 'admin@nhost.io' --non-interactive --agree-tos --server https://acme-v02.api.letsencrypt.org/directory

sudo cp /tmp/letsencrypt/live/local.db.nhost.run/fullchain.pem ssl/.ssl/
sudo cp /tmp/letsencrypt/live/local.db.nhost.run/privkey.pem ssl/.ssl/
