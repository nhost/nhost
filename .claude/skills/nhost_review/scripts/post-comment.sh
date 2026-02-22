#!/usr/bin/env bash
set -euo pipefail

# Write inline review comment to a local file at the repo root.
# Usage: post-comment.sh <pr-number> <file-path> <line> <body-file>

PR="$1"
FILE_PATH="$2"
LINE="$3"
BODY_FILE="$4"

N=1
while [ -f "PR_${PR}_COMMENT_${N}.md" ]; do
  N=$((N + 1))
done

{
  echo "**File:** \`${FILE_PATH}\`"
  echo "**Line:** ${LINE}"
  echo ""
  cat "$BODY_FILE"
} > "PR_${PR}_COMMENT_${N}.md"

echo "Wrote comment to PR_${PR}_COMMENT_${N}.md"
