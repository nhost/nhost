#!/usr/bin/env bash

set -euo pipefail

echo "⚒️⚒️⚒️ Building site..."
pnpm exec astro build

echo "⚒️⚒️⚒️ Checking for broken links..."
pnpm exec linkinator dist/ \
    --recurse \
    --skip '^https?://(?!localhost)' \
    --skip '\/reference\/' \
    --skip '\/deprecated\/' \
    --skip '\/favicon.svg$' \
    --skip '\/@vite\/client$' \
    --concurrency 10 \
    --timeout 30000 \
    --retry-errors \
    --retry-errors-count 3
