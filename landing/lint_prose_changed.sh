#!/usr/bin/env bash

set -euo pipefail

# Lints blog posts changed against main, uncommitted and untracked included.
# Keep in step with docs/lint_prose_changed.sh.

base=""
for candidate in origin/main main; do
  if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
    base="$candidate"
    break
  fi
done

if [[ -z "$base" ]]; then
  echo "ℹ️  Neither origin/main nor main exists; skipping the changed-posts prose lint."
  exit 0
fi

files=()
while IFS= read -r file; do
  case "$file" in
    *.md | *.mdx) files+=("$file") ;;
  esac
done < <(
  {
    git diff --relative --name-only --diff-filter=d --merge-base "$base" -- src/pages/blog
    git ls-files --others --exclude-standard -- src/pages/blog
  } | sort -u
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "✅ No changed blog posts against ${base}."
  exit 0
fi

echo "⚒️⚒️⚒️ Linting prose in ${#files[@]} post(s) changed against ${base}..."
vale "${files[@]}"
