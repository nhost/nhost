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
  '^https:\/\/github\.com\/signup$'

  # GitHub blocks datacenter IPs / the link checker on its signup page with 403
  # while the page loads fine in a real browser (false positive)
  'github\.com\/signup'

  # Microsoft support behind Akamai/Azure bot detection: returns 301 to real
  # browsers but 403/404 to datacenter IPs / the link checker (false positive)
  'support\.microsoft\.com'

  # Read the Docs aggressively rate-limits datacenter IPs: returns 429 to the
  # link checker even with retries, while the pages are live in a browser
  # (false positive)
  'hypopg\.readthedocs\.io'

  # Wikipedia rate-limits datacenter IPs / the link checker with 429 while the
  # pages load fine in a real browser (false positive)
  'en\.wikipedia\.org'

  # The site's own canonical/sitemap self-links; 404 until deployed.
  '^https:\/\/docs\.nhost\.io'
)

skip_args=()
for pattern in "${SKIP[@]}"; do
  skip_args+=(--skip "$pattern")
done

results="$(mktemp)"
trap 'rm -f "$results"' EXIT

# Run with the JSON reporter so we get a single machine-readable report
# instead of ~700 interleaved per-link lines; link_report.mjs renders it.
# Progress/errors still stream to stderr. `set +e` so a non-zero exit (broken
# links found) doesn't abort before we print the summary below.
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

# Report the links, and fail on broken ones or on an unreadable report. Node
# does the parsing (and skips linkinator's preamble) because it is already the
# toolchain this check runs under: the previous `jq` pipeline was never in the
# check sandbox, so its "command not found" was caught by a `2>/dev/null`
# parse guard that then exited with linkinator's status -- reporting a
# perfectly valid report as unparseable, and passing whenever linkinator
# itself passed.
if ! node ./link_report.mjs "$results"; then
  exit 1
fi

# No broken links in the report, so a non-zero linkinator exit means it failed
# for a reason the report cannot show (a crash, an unusable flag). Surface it
# rather than passing on an incomplete crawl.
if [[ "$linkinator_status" -ne 0 ]]; then
  echo "❌ linkinator exited ${linkinator_status} but reported no broken links." >&2
  exit "$linkinator_status"
fi
