#!/usr/bin/env bash

set -euo pipefail

echo "⚒️⚒️⚒️ Checking for broken links..."

# linkinator serves dist/client/ from its own local server and validates every
# <a>/<link>/<script>/<img> URL it finds, external links included.
#
SKIP=(
  # Generated reference docs & build artifacts (not authored content)
  '\/reference\/'
  '\/deprecated\/'
  '\/favicon.svg$'
  '\/@vite\/client$'

  # Per-project runtime domains — user-specific examples, never resolvable
  '\.nhost\.run'

  # Sign-in portals that reject automated requests with 4xx (false positives)
  'portal\.azure\.com'

  # Microsoft support behind Akamai/Azure bot detection: returns 301 to real
  # browsers but 403/404 to datacenter IPs / the link checker (false positive)
  'support\.microsoft\.com'

  # Read the Docs aggressively rate-limits datacenter IPs: returns 429 to the
  # link checker even with retries, while the pages are live in a browser
  # (false positive)
  'hypopg\.readthedocs\.io'

  # The site's own canonical/sitemap self-links; 404 until deployed.
  '^https:\/\/docs\.nhost\.io'
)

skip_args=()
for pattern in "${SKIP[@]}"; do
  skip_args+=(--skip "$pattern")
done

results="$(mktemp)"
trap 'rm -f "$results"' EXIT

# Run with the JSON reporter so we get a single machine-readable summary
# instead of ~700 per-link "OK" lines. Progress/errors still stream to
# stderr. `set +e` so a non-zero exit (broken links found) doesn't abort
# before we print the summary below.
set +e
pnpm exec linkinator dist/client/ \
  --recurse \
  --concurrency 10 \
  --timeout 30000 \
  --retry-errors \
  --retry-errors-count 3 \
  --format JSON \
  "${skip_args[@]}" >"$results"
linkinator_status=$?
set -e

# Strip any preamble (e.g. a pnpm lockfile warning) printed before the JSON
# object so jq sees valid JSON. linkinator's JSON reporter emits a single
# top-level object, so slice from the first line that starts with '{'.
sed -i -n '/^{/,$p' "$results"

if ! jq -e . "$results" >/dev/null 2>&1; then
  echo "❌ Could not parse linkinator output as JSON. Raw output:" >&2
  cat "$results" >&2
  exit "${linkinator_status:-1}"
fi

total="$(jq '.links | length' "$results")"
skipped="$(jq '[.links[] | select(.state == "SKIPPED")] | length' "$results")"
broken="$(jq '[.links[] | select(.state == "BROKEN")] | length' "$results")"

echo
echo "Checked ${total} links (${skipped} skipped)."

if [[ "$broken" -eq 0 ]]; then
  echo "✅ No broken links found."
  exit 0
fi

echo
echo "❌ ${broken} broken link(s), grouped by the page they appear on:"
echo
# For each source page, list the broken target URLs with their status code.
jq -r '
  [.links[] | select(.state == "BROKEN")]
  | group_by(.parent)[]
  | "📄 \(.[0].parent // "(unknown source)")",
    (.[] | "     [\(.status // 0)] \(.url)")
' "$results"

exit 1
