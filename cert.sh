#!/bin/sh

set -euo pipefail

docker run -it --rm \
  --name certbot \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION \
  -v $(PWD)/letsencrypt:/etc/letsencrypt \
  -v $(PWD)/letsencrypt:/var/lib/letsencrypt \
  certbot/dns-route53 certonly -v --dns-route53 --dns-route53-propagation-seconds 60 -d local.db.nhost.run -d local.graphql.nhost.run -d local.hasura.nhost.run -d local.auth.nhost.run -d local.storage.nhost.run -d local.functions.nhost.run -m 'admin@nhost.io' --non-interactive --agree-tos --server https://acme-v02.api.letsencrypt.org/directory

cp letsencrypt/live/local.db.nhost.run/fullchain.pem internal/ssl/.ssl/
cp letsencrypt/live/local.db.nhost.run/privkey.pem internal/ssl/.ssl/
