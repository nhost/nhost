#!/usr/bin/env bash
# Runs audit-ci in the current workspace and formats the result for humans
# and agents. Invoked per-workspace via `pnpm -r exec` (see package.json).
# Exits non-zero (from audit-ci) when vulnerabilities breach the threshold.
set -uo pipefail

json=$(audit-ci --config "$INIT_CWD/audit-ci.jsonc" --output-format json 2>/dev/null)
rc=$?
ws="${PWD#"$INIT_CWD"/}"

jq -r --arg ws "$ws" '
  (.advisories // {}) as $a
  | select(($a | length) > 0)
  | "\n📂 \($ws)",
    ($a | to_entries[] | .value |
      ([.findings[]?.version] | unique | join(", ")) as $ver |
      ([.findings[]?.paths[]?] | unique) as $paths |
      "  • \(.module_name)@\($ver) [\(.severity | ascii_upcase)]",
      "    \(.title)",
      "    Vulnerable: \(.vulnerable_versions)  →  Fix: \(.patched_versions // "none")",
      (if ($paths | length) > 0 then "    Path: \($paths[0])\(if ($paths|length) > 1 then " (+\($paths|length - 1) more)" else "" end)" else empty end),
      (if .url then "    \(.url)" else empty end)
    )
' <<< "$json" 2>/dev/null

exit $rc
