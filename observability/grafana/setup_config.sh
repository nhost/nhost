#!/bin/sh
set -euf

DATASOURCES=/var/lib/grafana/provisioning/datasources/datasources.yaml

mkdir -p /var/lib/grafana/provisioning/datasources

generate_datasources() {
    TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
    APP_ID=$(sed "s/nhost-//g" /var/run/secrets/kubernetes.io/serviceaccount/namespace)

    sed "s/\${TOKEN}/$TOKEN/g; s/\${APP_ID}/$APP_ID/g" \
    < /datasources.yaml.tmpl \
    > "${DATASOURCES}.tmp"
}

echo "setup-config: generating initial datasources"
generate_datasources
mv "${DATASOURCES}.tmp" "${DATASOURCES}"
echo "setup-config: initial datasources generated, entering refresh loop"

while true; do
    sleep 600
    generate_datasources
    if ! cmp -s "${DATASOURCES}.tmp" "${DATASOURCES}"; then
        echo "setup-config: SA token changed, updating datasources and reloading Grafana"
        mv "${DATASOURCES}.tmp" "${DATASOURCES}"
        curl -sf -X POST \
            -u "${GF_SECURITY_ADMIN_USER}:${GF_SECURITY_ADMIN_PASSWORD}" \
            http://localhost:3000/api/admin/provisioning/datasources/reload || echo "setup-config: failed to reload Grafana datasources"
    else
        rm "${DATASOURCES}.tmp"
    fi
done
