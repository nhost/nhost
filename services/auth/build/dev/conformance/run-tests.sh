#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFORMANCE_SUITE_PATH="${CONFORMANCE_SUITE_PATH:-${SCRIPT_DIR}/conformance-suite}"
CONFORMANCE_SERVER="${CONFORMANCE_SERVER:-https://localhost.emobix.co.uk:8443}"

# ---------- Python venv setup ----------

VENV_DIR="${CONFORMANCE_SUITE_PATH}/venv"
if [ ! -d "${VENV_DIR}" ]; then
    echo "==> Creating Python venv..."
    python3 -m venv "${VENV_DIR}"
fi
# shellcheck disable=SC1091
. "${VENV_DIR}/bin/activate"
pip install -q httpx pyparsing 2>/dev/null

# ---------- Test plan definitions ----------
#
# Each entry is: "<plan_name> <config_file>"
#
# Plan 1: Basic Certification — Static Clients
#   Tests the core Authorization Code flow with pre-registered clients using
#   both client_secret_basic and client_secret_post authentication.
#
# Plan 2: Config Certification — Discovery & Metadata
#   Validates the OpenID Connect Discovery document (/.well-known/openid-configuration)
#   and JWKS endpoint against the specification requirements.

PLANS=(
    "oidcc-basic-certification-test-plan[server_metadata=discovery][client_registration=static_client]  ${SCRIPT_DIR}/test-config.json"
    "oidcc-config-certification-test-plan ${SCRIPT_DIR}/test-config.json"
)

# ---------- Run plans ----------

RUNNER="${CONFORMANCE_SUITE_PATH}/scripts/run-test-plan.py"
if [ ! -f "${RUNNER}" ]; then
    echo "ERROR: run-test-plan.py not found at ${RUNNER}"
    echo "       Run ./run.sh first to clone and build the conformance suite."
    exit 1
fi

passed=0
failed=0
results=()

for entry in "${PLANS[@]}"; do
    plan=$(echo "${entry}" | awk '{print $1}')
    config=$(echo "${entry}" | awk '{print $2}')
    short_name=$(echo "${plan}" | sed 's/\[.*//') # strip variants for display

    if [ ! -f "${config}" ]; then
        echo "ERROR: Config file not found: ${config}"
        echo "       Run ./setup.sh first."
        exit 1
    fi

    echo ""
    echo "================================================================"
    echo "  Running: ${short_name}"
    echo "  Config:  $(basename "${config}")"
    echo "  Plan:    ${plan}"
    echo "================================================================"
    echo ""

    if CONFORMANCE_SERVER="${CONFORMANCE_SERVER}" \
       CONFORMANCE_DEV_MODE=1 \
       DISABLE_SSL_VERIFY=1 \
       python3 "${RUNNER}" \
           "${plan}" \
           "${config}"; then
        results+=("PASS  ${short_name} ($(basename "${config}"))")
        passed=$((passed + 1))
    else
        results+=("FAIL  ${short_name} ($(basename "${config}"))")
        failed=$((failed + 1))
    fi
done

# ---------- Summary ----------

echo ""
echo "================================================================"
echo "  Results: ${passed} passed, ${failed} failed"
echo "================================================================"
for r in "${results[@]}"; do
    echo "  ${r}"
done
echo ""

if [ "${failed}" -gt 0 ]; then
    exit 1
fi
