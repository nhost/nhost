#!/usr/bin/env bash
set -euo pipefail

# Write PR description to a local file at the repo root.
# Usage: post-description.sh <pr-number> <body-file>

PR="$1"
BODY_FILE="$2"

cp "$BODY_FILE" "PR_${PR}_DESCRIPTION.md"
echo "Wrote PR description to PR_${PR}_DESCRIPTION.md"
