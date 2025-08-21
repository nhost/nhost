#!/bin/sh
set -euo pipefail

echo "➜ Installing browsers and dependencies"
playwright install chrome --with-deps || echo "⚠️⚠️⚠️ Failed to install browsers and dependencies ⚠️⚠️⚠️"

echo "➜ Running onboarding e2e tests"
playwright test --config=playwright.config.ts -x --project=onboarding || echo "⚠️⚠️⚠️ onboarding tests failed ⚠️⚠️⚠️"

echo "➜ Running main e2e tests"
playwright test --config=playwright.config.ts -x --project=main || echo "⚠️⚠️⚠️ main e2e tests failed ⚠️⚠️⚠️"
