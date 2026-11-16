#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"
config="${BETTERLEAKS_TEST_CONFIG:-$PWD/../betterleaks.toml}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/detect" "$tmp/ignore/generated" "$tmp/ignore/__generated__"

# ---- must be reported -------------------------------------------------------
cat >"$tmp/detect/double_quoted.go" <<'FIXTURE'
package example
const adminSecret = "LiveSecretDoubleQuotedAAA111"
FIXTURE
cat >"$tmp/detect/single_quoted.py" <<'FIXTURE'
ADMIN_SECRET = 'LiveSecretSingleQuotedBBB222'
FIXTURE
cat >"$tmp/detect/backtick_raw_string.go" <<'FIXTURE'
package example
const adminSecret = `LiveSecretBacktickCCC333`
FIXTURE
cat >"$tmp/detect/backtick_template_literal.ts" <<'FIXTURE'
export const adminSecret = `LiveSecretBacktickDDD444`
FIXTURE
cat >"$tmp/detect/env_assignment.env" <<'FIXTURE'
HASURA_GRAPHQL_ADMIN_SECRET=LiveSecretEnvEEE555
FIXTURE
cat >"$tmp/detect/cli_flag.sh" <<'FIXTURE'
nhost run --admin-secret LiveSecretCliFFF666
FIXTURE
cat >"$tmp/detect/embedded_in_string.ts" <<'FIXTURE'
const header = "x-hasura-admin-secret: LiveSecretEmbeddedGGG777";
FIXTURE

# ---- must NOT be reported ---------------------------------------------------
cat >"$tmp/ignore/bare_identifier.ts" <<'FIXTURE'
const client = createClient({ adminSecret: options.adminSecret });
FIXTURE
cat >"$tmp/ignore/env_lookup.go" <<'FIXTURE'
package example
var adminSecret = os.Getenv("HASURA_GRAPHQL_ADMIN_SECRET")
FIXTURE
cat >"$tmp/ignore/allowlisted_placeholder.env" <<'FIXTURE'
HASURA_GRAPHQL_ADMIN_SECRET=nhost-admin-secret
FIXTURE
cat >"$tmp/ignore/inline_allow.py" <<'FIXTURE'
ADMIN_SECRET = "LiveSecretAllowedHHH888"  # betterleaks:allow
FIXTURE
cat >"$tmp/ignore/generated/client.ts" <<'FIXTURE'
const adminSecret = "LiveSecretGeneratedIII999";
FIXTURE
cat >"$tmp/ignore/__generated__/client.ts" <<'FIXTURE'
const adminSecret = "LiveSecretDunderGenJJJ000";
FIXTURE
cat >"$tmp/ignore/schema.gen.ts" <<'FIXTURE'
const adminSecret = "LiveSecretGenSuffixKKK111";
FIXTURE

cd "$tmp"

betterleaks dir . \
  --config "$config" \
  --enable-rule nhost-hasura-admin-secret \
  --confidence medium \
  --exit-code 0 \
  --no-banner \
  --no-color \
  -f json \
  -r report.json >/dev/null


jq -r '(. // [])[] | "\(.File):\(.StartLine):\(.Secret)"' report.json | sort >actual.txt
cat >expected.txt <<'EXPECTED'
detect/backtick_raw_string.go:2:LiveSecretBacktickCCC333
detect/backtick_template_literal.ts:1:LiveSecretBacktickDDD444
detect/cli_flag.sh:1:LiveSecretCliFFF666
detect/double_quoted.go:2:LiveSecretDoubleQuotedAAA111
detect/embedded_in_string.ts:1:LiveSecretEmbeddedGGG777
detect/env_assignment.env:1:LiveSecretEnvEEE555
detect/single_quoted.py:1:LiveSecretSingleQuotedBBB222
EXPECTED
sort -o expected.txt expected.txt

if ! diff -u expected.txt actual.txt; then
  echo "FAIL: '-' expected but missing/changed, '+' reported but should not be" >&2
  exit 1
fi
echo "nhost-hasura-admin-secret: ok, $(wc -l <expected.txt | tr -d ' ') detected, $(find ignore -type f | wc -l | tr -d ' ') ignored"
