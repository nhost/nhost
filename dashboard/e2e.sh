#!/bin/sh
set -euo pipefail

echo "➜ Installing browsers and dependencies"
pnpm playwright install chrome --with-deps

echo "➜ Running onboarding e2e tests"
pnpm playwright test --config=playwright.config.ts -x --project=onboarding

echo "➜ Running main e2e tests"
pnpm playwright test --config=playwright.config.ts -x --project=main
