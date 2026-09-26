#!/bin/sh
set -eu

fetch_script=${1:?'usage: wal-fetch.sh <fetch-script>'}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/wal-fetch-test.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
cat >"$test_dir/wal-g" <<'EOF'
#!/bin/sh
[ "$1" = wal-fetch ] && [ "$2" = segment ] && [ "$3" = destination ] || exit 99
exit "$WALG_EXIT_CODE"
EOF
chmod +x "$test_dir/wal-g"
PATH="$test_dir:$PATH"
export PATH
for pair in '0 0' '74 1' '1 126' '17 126'; do
	set -- $pair
	WALG_EXIT_CODE=$1
	export WALG_EXIT_CODE
	status=0
	sh "$fetch_script" segment destination >"$test_dir/stdout" 2>"$test_dir/stderr" || status=$?
	if [ "$status" -ne "$2" ]; then
		echo "WAL-G exit $1 produced restore exit $status instead of $2" >&2
		exit 1
	fi
done
