#!/bin/sh
set -euo pipefail

echo "➜ Installing browsers and dependencies"
pnpm run playwright install chrome --with-deps

echo "➜ Running onboarding e2e tests"
pnpm run playwright test --config=playwright.config.ts -x --project=onboarding

echo "➜ Running main e2e tests"
pnpm run playwright test --config=playwright.config.ts -x --project=main
