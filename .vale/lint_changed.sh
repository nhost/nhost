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

# shellcheck source=SCRIPTDIR/changed.sh
source "$(dirname "${BASH_SOURCE[0]}")/changed.sh"
changed_markdown "$dir"

if [[ -z $changed_base ]]; then
	echo "ℹ️  Neither origin/main nor main exists; skipping the changed-files prose lint."
	exit 0
fi

if [[ ${#changed[@]} -eq 0 ]]; then
	echo "✅ No changed Markdown under ${dir} against ${changed_base}."
	exit 0
fi

echo "⚒️⚒️⚒️ Linting prose in ${#changed[@]} file(s) changed against ${changed_base}..."
vale "${changed[@]}"
