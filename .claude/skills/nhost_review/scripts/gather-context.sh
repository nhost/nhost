#!/usr/bin/env bash
set -euo pipefail

# Gather all context for nhost_reviewer skill using local git.
# Usage: gather-context.sh [base-ref]
# If no base ref is provided, defaults to origin/main.

BASE="${1:-origin/main}"

# Try to detect PR number from current branch, fall back to XXX
PR=$(gh pr view --json number -q .number 2>/dev/null || echo "XXX")
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "OWNER/REPO")

# Portable SHA256: sha256sum on Linux, shasum on macOS
if command -v sha256sum &>/dev/null; then
  sha256() { sha256sum | cut -d' ' -f1; }
else
  sha256() { shasum -a 256 | cut -d' ' -f1; }
fi

git fetch origin main --quiet 2>/dev/null || true
MERGE_BASE=$(git merge-base "$BASE" HEAD)

# Pathspec to exclude generated/vendored files from the diff
EXCLUDES=(
  ':(exclude)vendor/**'
  ':(exclude)**/node_modules/**'
  ':(exclude)**/*.gen.go'
  ':(exclude)**/*_gen.go'
  ':(exclude)**/mock/**'
  ':(exclude)**/sql/query.sql.go'
  ':(exclude)**/sql/models.go'
  ':(exclude)**/__generated__/**'
  ':(exclude)**.generated.ts'
  ':(exclude)**/pnpm-lock.yaml'
  ':(exclude)**/go.sum'
)

echo "### PR_NUMBER: ${PR}"
echo "### REPO: ${REPO}"
echo ""

echo "### CHANGED_FILES_WITH_STATS"
echo "Format: filepath | sha256hash | +additions/-deletions"
git diff "$MERGE_BASE" --numstat -- . | while read -r additions deletions filepath; do
  hash=$(echo -n "$filepath" | sha256)
  echo "${filepath} | ${hash} | +${additions}/-${deletions}"
done
echo ""

echo "### DIFF"
echo "Diff of changed files (excluding generated/vendored):"

git diff "$MERGE_BASE" -- . "${EXCLUDES[@]}"
