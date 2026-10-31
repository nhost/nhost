#!/usr/bin/env bash

set -euo pipefail

# Lints docs pages changed against main, uncommitted and untracked included.

base=""
for candidate in origin/main main; do
  if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
    base="$candidate"
    break
  fi
done

if [[ -z "$base" ]]; then
  echo "ℹ️  Neither origin/main nor main exists; skipping the changed-pages prose lint."
  exit 0
fi

files=()
while IFS= read -r file; do
  case "$file" in
    *.md | *.mdx) files+=("$file") ;;
  esac
done < <(
  {
    git diff --relative --name-only --diff-filter=d --merge-base "$base" -- src/content/docs
    git ls-files --others --exclude-standard -- src/content/docs
  } | sort -u
)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "✅ No changed docs pages against ${base}."
  exit 0
fi

echo "⚒️⚒️⚒️ Linting prose in ${#files[@]} page(s) changed against ${base}..."
vale "${files[@]}"
