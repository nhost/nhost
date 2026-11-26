# shellcheck shell=bash
# Sourced by lint_changed.sh and lint_markdown.sh.
#
# changed_markdown <dir> sets `changed` to the Markdown under <dir> that
# changed against main, uncommitted and untracked files included, as paths
# relative to the working directory. It sets `changed_base` to the ref it
# compared against, or to "" when neither origin/main nor main exists.
changed_markdown() {
	local dir=$1 candidate merge_base file

	changed=()
	changed_base=""
	for candidate in origin/main main; do
		if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
			changed_base=$candidate
			break
		fi
	done
	if [[ -z $changed_base ]]; then
		return 0
	fi

	# Resolved here rather than with `git diff --merge-base`, whose failure inside
	# the process substitution below would pass as "nothing changed".
	merge_base=$(git merge-base "$changed_base" HEAD) || {
		echo "No merge base between ${changed_base} and HEAD; fetch more history." >&2
		return 1
	}

	while IFS= read -r file; do
		case "$file" in
		*.md | *.mdx) changed+=("$file") ;;
		esac
	done < <(
		{
			git diff --relative --name-only --diff-filter=d "$merge_base" -- "$dir"
			git ls-files --others --exclude-standard -- "$dir"
		} | sort -u
	)
}
