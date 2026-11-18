#!/usr/bin/env bash

set -euo pipefail

# Lints the Markdown under one directory that changed against main,
# uncommitted and untracked files included. Run from the package directory
# (the pnpm `lint:prose:changed` scripts do) so Vale picks its .vale.ini.

if [[ $# -ne 1 ]]; then
	echo "usage: ${BASH_SOURCE[0]} <dir>" >&2
	exit 2
fi
dir=$1

base=""
for candidate in origin/main main; do
	if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
		base="$candidate"
		break
	fi
done

if [[ -z "$base" ]]; then
	echo "ℹ️  Neither origin/main nor main exists; skipping the changed-files prose lint."
	exit 0
fi

# Resolved here rather than with `git diff --merge-base`, whose failure inside
# the process substitution below would pass as "nothing changed".
merge_base=$(git merge-base "$base" HEAD) || {
	echo "No merge base between ${base} and HEAD; fetch more history." >&2
	exit 1
}

files=()
while IFS= read -r file; do
	case "$file" in
	*.md | *.mdx) files+=("$file") ;;
	esac
done < <(
	{
		git diff --relative --name-only --diff-filter=d "$merge_base" -- "$dir"
		git ls-files --others --exclude-standard -- "$dir"
	} | sort -u
)

if [[ ${#files[@]} -eq 0 ]]; then
	echo "✅ No changed Markdown under ${dir} against ${base}."
	exit 0
fi

echo "⚒️⚒️⚒️ Linting prose in ${#files[@]} file(s) changed against ${base}..."
vale "${files[@]}"
