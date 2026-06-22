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

  # The site's own canonical/sitemap self-links; 404 until deployed.
  '^https:\/\/docs\.nhost\.io'
)

skip_args=()
for pattern in "${SKIP[@]}"; do
  skip_args+=(--skip "$pattern")
done

pnpm exec linkinator dist/client/ \
  --recurse \
  --concurrency 10 \
  --timeout 30000 \
  --retry-errors \
  --retry-errors-count 3 \
  "${skip_args[@]}"
