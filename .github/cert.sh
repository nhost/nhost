#!/bin/sh

set -euo pipefail

echo "Generating SSL certificate for hostnames: local.nhost.run, local.graphql.nhost.run, local.auth.nhost.run, local.storage.nhost.run, local.functions.nhost.run, local.mail.nhost.run"
docker run --rm \
  --name certbot \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_REGION \
  -v ${PWD}/letsencrypt:/etc/letsencrypt \
  -v ${PWD}/letsencrypt:/var/lib/letsencrypt \
  certbot/dns-route53 certonly --dns-route53 --dns-route53-propagation-seconds 60 -d local.nhost.run -d local.graphql.nhost.run -d local.auth.nhost.run -d local.storage.nhost.run -d local.functions.nhost.run -d local.mail.nhost.run -m 'siarhei@nhost.io' --non-interactive --agree-tos --server https://acme-v02.api.letsencrypt.org/directory

sudo cp letsencrypt/live/localdev.nhost.run/fullchain.pem internal/ssl/.ssl/
sudo cp letsencrypt/live/localdev.nhost.run/privkey.pem internal/ssl/.ssl/
