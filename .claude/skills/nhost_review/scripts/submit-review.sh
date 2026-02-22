#!/usr/bin/env bash
set -euo pipefail

# Write final review summary to a local file at the repo root.
# Usage: submit-review.sh <pr-number> <event> <body-file>
# event: approve, request-changes, or comment

PR="$1"
EVENT="$2"
BODY_FILE="$3"

{
  echo "**Decision:** ${EVENT}"
  echo ""
  cat "$BODY_FILE"
} > "PR_${PR}_REVIEW.md"

echo "Wrote review summary to PR_${PR}_REVIEW.md"
