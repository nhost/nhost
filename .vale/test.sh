#!/usr/bin/env bash

# Fixture tests for the Nhost Vale rules.
#
#   .vale/tests/<Style>/<Rule>/fail.mdx   reports exactly expected.txt, every
#                                         line from <Style>.<Rule>
#   .vale/tests/<Style>/<Rule>/pass.mdx   reports nothing
#   .vale/tests/Nhost/Ignores/{fail,pass} the TokenIgnores fixture, same shape
#   tools/writing/calibration/docs/*/{draft,final}.mdx
#                                         error level only, compared with
#                                         .vale/tests/calibration/expected-errors.txt
#
# Vale runs from the repository root so the paths in --output=line match the
# expected files wherever a fixture lives. `./.vale/test.sh --update` rewrites
# every expected file from the current output, creating a missing one; review
# the diff before committing it.
#
# Fixtures are grouped by style, so a second style gets its own tree without
# moving these.

set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$script_dir/.."

config=.vale/tests/.vale.ini
tests_dir=.vale/tests
styles_root=.vale/styles
styles=(Nhost)
calibration_expected=$tests_dir/calibration/expected-errors.txt

update=false
if [[ ${1:-} == "--update" ]]; then
	update=true
fi

temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

failures=0

fail() {
	echo "FAIL: $*" >&2
	failures=$((failures + 1))
}

lint() {
	local level=$1
	shift
	vale --config "$config" --output=line --no-exit --minAlertLevel="$level" "$@" |
		LC_ALL=C sort -t: -k1,1 -k2,2n -k3,3n -k4,4
}

# compare <expected file> <actual file> <label>
compare() {
	if [[ $update == true ]]; then
		cp "$2" "$1"
		return
	fi
	if ! diff -u "$1" "$2" >&2; then
		fail "$3: '-' expected but not reported, '+' reported but not expected"
	fi
}

# Every rule that is not vendored has a fixture directory.
for style in "${styles[@]}"; do
	for rule_file in "$styles_root/$style"/*.yml; do
		if grep -q '^# Vendored from' "$rule_file"; then
			continue
		fi
		rule=$(basename "$rule_file" .yml)
		if [[ ! -d $tests_dir/$style/$rule ]]; then
			fail "$style.$rule has no fixture directory $tests_dir/$style/$rule"
		fi
	done
done

rules=0
for style in "${styles[@]}"; do
	for dir in "$tests_dir/$style"/*/; do
		dir=${dir%/}
		name=$(basename "$dir")
		rules=$((rules + 1))

		for fixture in fail.mdx pass.mdx; do
			if [[ ! -f $dir/$fixture ]]; then
				fail "$dir/$fixture is missing"
				continue 2
			fi
		done
		# --update writes a missing expected.txt, so a new rule can be bootstrapped.
		if [[ $update != true && ! -f $dir/expected.txt ]]; then
			fail "$dir/expected.txt is missing; generate it with ./.vale/test.sh --update"
			continue
		fi

		lint suggestion "$dir/fail.mdx" >"$temp_dir/fail.txt"
		if [[ ! -s $temp_dir/fail.txt ]]; then
			fail "$dir/fail.mdx reports nothing"
		fi
		if [[ $name != Ignores ]]; then
			# --output=line is path:line:column:check:message
			if awk -F: -v want="$style.$name" '$4 != want { found = 1 } END { exit !found }' "$temp_dir/fail.txt"; then
				fail "$dir/fail.mdx reports a check other than $style.$name"
			fi
		fi
		compare "$dir/expected.txt" "$temp_dir/fail.txt" "$dir/fail.mdx"

		lint suggestion "$dir/pass.mdx" >"$temp_dir/pass.txt"
		if [[ -s $temp_dir/pass.txt ]]; then
			cat "$temp_dir/pass.txt" >&2
			fail "$dir/pass.mdx reports alerts"
		fi
	done
done

calibration_fixtures=(tools/writing/calibration/docs/*/draft.mdx tools/writing/calibration/docs/*/final.mdx)
lint error "${calibration_fixtures[@]}" >"$temp_dir/calibration.txt"
compare "$calibration_expected" "$temp_dir/calibration.txt" "calibration fixtures"

if ((failures > 0)); then
	echo "vale_test: $failures failure(s)" >&2
	exit 1
fi

if [[ $update == true ]]; then
	echo "vale_test: expected files rewritten; review them with git diff"
	exit 0
fi

echo "vale_test: ok, $rules fixture pairs, ${#calibration_fixtures[@]} calibration files"
