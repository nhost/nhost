#!/usr/bin/env bash

set -euo pipefail

# Checks tracked Markdown for misspellings with typos and the root
# .typos.toml. Unlike lint_markdown.sh this covers the docs site and the blog
# too, since spelling does not depend on the Vale config. Arguments are passed
# to typos, so `--diff` previews fixes and `--write-changes` applies them.

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
