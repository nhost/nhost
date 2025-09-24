#!/usr/bin/env bash

set -euo pipefail

output=$(pnpm exec mintlify broken-links)
echo "$output"
echo "$output" | grep -q "success"
