#!/bin/sh

set -eu

repair_script=${1:?"usage: $0 <repair-collation-script>"}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/repair-collation-test.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM

cat >"$test_dir/psql" <<'EOF'
#!/bin/sh

set -eu

database=
sql=
while [ "$#" -gt 0 ]; do
	case $1 in
	-d)
		database=$2
		shift 2
		;;
	-c)
		sql=$2
		shift 2
		;;
	*)
		shift
		;;
	esac
done

if [ -z "$sql" ]; then
	sql=$(cat)
fi

case $sql in
*"REINDEX DATABASE"*"REFRESH COLLATION VERSION"*)
	echo "reindex and refresh must use separate psql calls" >&2
	exit 1
	;;
*"WHERE datallowconn"*)
	printf 'first\0broken\0last\0'
	exit 0
	;;
*"datcollversion IS DISTINCT"*)
	action=check
	;;
*"REINDEX DATABASE"*)
	action=reindex
	;;
*"REFRESH COLLATION VERSION"*)
	action=refresh
	;;
*)
	echo "unexpected psql input" >&2
	exit 1
	;;
esac

printf '%s %s\n' "$database" "$action" >>"$REPAIR_TRACE"

if [ "$action" = check ]; then
	printf '%s\n' "${COLLATION_MISMATCH:-t}"
	exit 0
fi

if [ "$database" = broken ] && [ "$action" = reindex ]; then
	# psql does not normally use 255, but normalizing this worst-case status
	# proves one failed repair cannot make xargs skip later databases.
	exit 255
fi
EOF
chmod +x "$test_dir/psql"

export REPAIR_TRACE="$test_dir/trace"
repair_status=0
PATH="$test_dir:$PATH" TMPDIR="$test_dir" "$repair_script" \
	>"$test_dir/stdout" 2>"$test_dir/stderr" || repair_status=$?
if [ "$repair_status" -ne 1 ]; then
	echo "repair returned $repair_status, expected 1" >&2
	exit 1
fi

cat >"$test_dir/expected-trace" <<'EOF'
first check
first reindex
first refresh
broken check
broken reindex
last check
last reindex
last refresh
EOF

diff -u "$test_dir/expected-trace" "$REPAIR_TRACE"
grep -Fq "Failed to rebuild collation-dependent indexes" "$test_dir/stderr"
grep -Fq "Failed to repair a database collation version" "$test_dir/stderr"
grep -Fq "Failed to repair database collation versions" "$test_dir/stderr"

: >"$REPAIR_TRACE"
COLLATION_MISMATCH=f PATH="$test_dir:$PATH" TMPDIR="$test_dir" \
	"$repair_script" --database current
printf '%s\n' "current check" >"$test_dir/expected-trace"
diff -u "$test_dir/expected-trace" "$REPAIR_TRACE"
