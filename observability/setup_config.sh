#!/usr/bin/env sh
set -euf

mkdir -p /var/lib/grafana/provisioning/datasources

TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
APP_ID=$(sed "s/nhost-//g" /var/run/secrets/kubernetes.io/serviceaccount/namespace)

sed "s/\${TOKEN}/$TOKEN/g; s/\${APP_ID}/$APP_ID/g" \
< /datasources.yaml.tmpl \
> /var/lib/grafana/provisioning/datasources/datasources.yaml
