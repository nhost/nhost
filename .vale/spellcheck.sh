#!/usr/bin/env bash

set -euo pipefail

# Runs typos over all tracked Markdown, docs and blog included. Arguments go
# to typos, e.g. `--diff` or `--write-changes`.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

list_files() {
	if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		git ls-files -- '*.md' '*.mdx'
	else
		find . \( -name node_modules -o -name .git \) -prune -o \
			-type f \( -name '*.md' -o -name '*.mdx' \) -print | sed 's|^\./||'
	fi
}

list_files | LC_ALL=C sort | typos --force-exclude "$@" --file-list -
