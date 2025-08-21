#!/bin/sh
set -euo pipefail

echo "➜ Running onboarding e2e tests"
playwright test --config=playwright.config.ts -x --project=onboarding || echo "⚠️⚠️⚠️ onboarding tests failed ⚠️⚠️⚠️"

echo "➜ Running main e2e tests"
playwright test --config=playwright.config.ts -x --project=main || echo "⚠️⚠️⚠️ main e2e tests failed ⚠️⚠️⚠️"
