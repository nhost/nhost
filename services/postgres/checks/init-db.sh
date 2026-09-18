#!/bin/sh

set -eu

init_script=${1:?'usage: init-db.sh <init-script>'}
test_dir=$(mktemp -d "${TMPDIR:-/tmp}/init-db-test.XXXXXX")
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM

if [ "$(tail -n 1 "$init_script")" != main ]; then
	echo "expected the init script to end by invoking main" >&2
	exit 1
fi
sed '$d' "$init_script" >"$test_dir/init-functions.sh"

mkdir "$test_dir/bin"
cat >"$test_dir/bin/mktemp" <<'EOF'
#!/bin/sh

set -eu
: >"$INIT_TEST_PASSWORD_FILE"
printf '%s\n' "$INIT_TEST_PASSWORD_FILE"
EOF

cat >"$test_dir/bin/initdb" <<'EOF'
#!/bin/sh

set -eu

if [ "$1" != "--username=$POSTGRES_USER" ]; then
	echo "initdb received an unexpected username argument" >&2
	exit 1
fi
password_file=${2#--pwfile=}
if [ ! -s "$password_file" ]; then
	echo "initdb received an empty password file" >&2
	exit 1
fi

if [ "${INITDB_MODE:-success}" = failure ]; then
	touch "$PGDATA/partial-cluster"
	exit 1
fi

if find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
	echo "initdb received a non-empty PGDATA" >&2
	exit 1
fi
printf '18\n' >"$PGDATA/PG_VERSION"
EOF
chmod +x "$test_dir/bin/mktemp" "$test_dir/bin/initdb"

export PATH="$test_dir/bin:$PATH"
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=test-password
export INIT_TEST_PASSWORD_FILE="$test_dir/postgres-password"

(
	PGDATA="$test_dir/fresh/nested/pgdata"
	export PGDATA
	[ ! -e "$PGDATA" ]

	# shellcheck source=/dev/null
	. "$test_dir/init-functions.sh"
	init_db

	[ "$DATABASE_INITIALIZED" = true ]
	[ -f "$PGDATA/PG_VERSION" ]
	[ -f "$PGDATA/.nhost-initdb-in-progress" ]
)

(
	PGDATA="$test_dir/interrupted-pgdata"
	export PGDATA
	mkdir "$PGDATA"
	touch "$PGDATA/partial-cluster"

	# shellcheck source=/dev/null
	. "$test_dir/init-functions.sh"
	init_db

	[ "$DATABASE_INITIALIZED" = true ]
	[ -f "$PGDATA/PG_VERSION" ]
	[ -f "$PGDATA/.nhost-initdb-in-progress" ]
	[ ! -e "$PGDATA/partial-cluster" ]
)

(
	PGDATA="$test_dir/failed-pgdata"
	INITDB_MODE=failure
	export PGDATA INITDB_MODE
	mkdir "$PGDATA"

	# shellcheck source=/dev/null
	. "$test_dir/init-functions.sh"
	if init_db; then
		echo "init_db unexpectedly succeeded after initdb failed" >&2
		exit 1
	fi
	if find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
		echo "init_db retained files created by failed initdb" >&2
		exit 1
	fi
	[ ! -e "$INIT_TEST_PASSWORD_FILE" ]

	INITDB_MODE=success
	export INITDB_MODE
	init_db
	[ "$DATABASE_INITIALIZED" = true ]
	[ -f "$PGDATA/PG_VERSION" ]
)

(
	PGDATA="$test_dir/completed-without-version-pgdata"
	export PGDATA
	mkdir "$PGDATA"
	touch "$PGDATA/.nhost-initdb-complete" "$PGDATA/sentinel"

	# shellcheck source=/dev/null
	. "$test_dir/init-functions.sh"
	if init_db 2>"$test_dir/completed-marker-error"; then
		echo "init_db unexpectedly accepted a completion marker without PG_VERSION" >&2
		exit 1
	fi
	grep -Fxq "Database initialization is marked complete, but PG_VERSION is missing" \
		"$test_dir/completed-marker-error"
	[ -f "$PGDATA/.nhost-initdb-complete" ]
	[ -f "$PGDATA/sentinel" ]
	[ ! -e "$PGDATA/PG_VERSION" ]
)
