#!/usr/bin/env bash

set -euo pipefail

# Lints tracked Markdown with the root .vale.ini, minus .vale/markdown.ignore.
# With a leading --changed, lints only the Markdown changed against main,
# uncommitted and untracked files included. Other arguments go to Vale. Falls
# back to `find` in the Nix sandbox, which has no git.

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

changed_only=false
if [[ ${1:-} == "--changed" ]]; then
	changed_only=true
	shift

	# shellcheck source=changed.sh
	source .vale/changed.sh
	changed_markdown .
	if [[ -z $changed_base ]]; then
		echo "ℹ️  Neither origin/main nor main exists; skipping the changed-files prose lint."
		exit 0
	fi
fi

ignore_file=.vale/markdown.ignore

patterns=()
while IFS= read -r line; do
	line=${line%%#*}
	line=${line%"${line##*[![:space:]]}"}
	[[ -n $line ]] && patterns+=("$line")
done <"$ignore_file"

ignored() {
	local pattern
	for pattern in "${patterns[@]}"; do
		# shellcheck disable=SC2053 # the pattern is a glob on purpose
		if [[ $1 == $pattern ]]; then
			return 0
		fi
	done
	return 1
}

list_files() {
	if [[ $changed_only == true ]]; then
		if [[ ${#changed[@]} -gt 0 ]]; then
			printf '%s\n' "${changed[@]}"
		fi
	elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
		git ls-files -- '*.md' '*.mdx'
	else
		find . \( -name node_modules -o -name .git \) -prune -o \
			-type f \( -name '*.md' -o -name '*.mdx' \) -print | sed 's|^\./||'
	fi
}

files=()
while IFS= read -r file; do
	if ! ignored "$file"; then
		files+=("$file")
	fi
done < <(list_files | LC_ALL=C sort)

if [[ ${#files[@]} -eq 0 ]]; then
	if [[ $changed_only == true ]]; then
		echo "✅ No changed repository Markdown against ${changed_base}."
	else
		echo "No Markdown files to lint."
	fi
	exit 0
fi

if [[ $changed_only == true ]]; then
	echo "⚒️⚒️⚒️ Linting prose in ${#files[@]} file(s) changed against ${changed_base}..."
fi

vale --config .vale.ini "$@" "${files[@]}"
