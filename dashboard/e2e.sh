#!/bin/sh
pnpm playwright install --with-deps
pnpm e2e:onboarding
pnpm e2e
