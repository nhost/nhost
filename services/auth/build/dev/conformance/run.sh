#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFORMANCE_SUITE_PATH="${CONFORMANCE_SUITE_PATH:-${SCRIPT_DIR}/conformance-suite}"

echo "==> Step 1: Clone conformance suite (if needed)..."
if [ ! -d "${CONFORMANCE_SUITE_PATH}" ]; then
    git clone --depth 1 https://gitlab.com/openid/conformance-suite.git "${CONFORMANCE_SUITE_PATH}"
else
    echo "    Already cloned at ${CONFORMANCE_SUITE_PATH}"
fi

echo ""
echo "==> Step 2: Build conformance suite JAR with Maven (in Docker)..."
if [ ! -f "${CONFORMANCE_SUITE_PATH}/target/fapi-test-suite.jar" ]; then
    docker run --rm \
        -v "${CONFORMANCE_SUITE_PATH}:/app" \
        -w /app \
        maven:3-eclipse-temurin-17 \
        mvn clean package -DskipTests -q
    echo "    JAR built successfully."
else
    echo "    JAR already exists, skipping build."
fi

echo ""
echo "==> Step 3: Build and start all services..."
export CONFORMANCE_SUITE_PATH
cd "${SCRIPT_DIR}"
docker compose build
docker compose up -d

echo ""
echo "==> Step 4: Run setup (create user + OAuth2 clients)..."
"${SCRIPT_DIR}/setup.sh"

echo ""
echo "============================================"
echo "  All services are running!"
echo "============================================"
echo ""
echo "  Conformance suite UI: https://localhost.emobix.co.uk:8443"
echo "  Auth service:         http://localhost:4000"
echo "  OIDC Discovery:       http://localhost:4000/.well-known/openid-configuration"
echo ""
echo "  To run all test plans programmatically:"
echo "    ./run-tests.sh"
echo ""
echo "  To run a single plan:"
echo "    cd ${CONFORMANCE_SUITE_PATH}"
echo "    CONFORMANCE_SERVER=https://localhost.emobix.co.uk:8443 \\"
echo "    CONFORMANCE_DEV_MODE=1 \\"
echo "    DISABLE_SSL_VERIFY=1 \\"
echo "    python3 scripts/run-test-plan.py \\"
echo "      'oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]' \\"
echo "      ${SCRIPT_DIR}/test-config.json"
echo ""
echo "  To stop:"
echo "    docker compose down --volumes"
echo ""
