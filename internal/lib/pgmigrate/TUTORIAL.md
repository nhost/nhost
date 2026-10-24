# Tutorial: upgrade and roll back a hello-world app

In this tutorial you will build three versions of a tiny Go app. Each build runs `pgmigrate` on startup, then prints a greeting. SQL migrations change a `hello.greetings` table, which you will inspect with `psql`.

The important part comes at the end: **you will delete the source code and SQL files, then start the older binaries**. They will undo newer migrations using SQL saved in PostgreSQL—not files shipped with the older build.

| Build | Embedded migrations | Effect when upgrading |
| --- | --- | --- |
| v1 | 1 | Create a table containing `Hello, world!` |
| v2 | 1, 2 | Add a language column and change the greeting |
| v3 | 1, 2, 3 | Add a Spanish greeting |

Then you will run v2 and v1 again, moving the database from **3 → 2 → 1** without passing any migration commands or target flags.

This is a local demonstration, not a production deployment or a backup/restore procedure. Use the [README](README.md) for integration and rollout requirements, and the [recovery guide](RECOVERY.md) only if a migration fails.

## Before you start

You need a checkout of the Nhost repository. `pgmigrate` is an internal Go package, so do not create a separate Go module for this example.

Run the commands from the **repository root, in one Bash terminal**, as a normal user—not root. You need Go 1.27 or later and PostgreSQL's `initdb`, `pg_ctl`, and `psql`. The project's Nix shell provides them:

```bash
nix develop .#pgmigrate
```

If those tools are already installed, you can use your existing Bash shell instead. On macOS, use native macOS PostgreSQL binaries, not Linux binaries from a remote Nix builder.

## 1. Start a disposable database

Everything goes into temporary directories. The server listens only on a private Unix socket, not on a network port. Trust authentication is convenient for this isolated demo; **do not use it as a production authentication configuration**.

```bash
set -euo pipefail

mkdir -p .nhost-code/tmp
demo=$(mktemp -d "$PWD/.nhost-code/tmp/pgmigrate-hello.XXXXXX")

export PGDATA="$demo/pgdata"
export PGHOST=$(mktemp -d /tmp/pgmigrate-hello.XXXXXX)
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres
export DATABASE_URL="host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=disable"

cleanup() {
  if [ -f "$PGDATA/postmaster.pid" ]; then
    pg_ctl -D "$PGDATA" -m fast -w stop || return 1
  fi
  rm -rf -- "$demo" "$PGHOST"
}
trap cleanup EXIT

initdb --auth=trust --no-locale --encoding=UTF8 -U postgres -D "$PGDATA"
pg_ctl -D "$PGDATA" -l "$demo/postgres.log" \
  -o "-F -h '' -k $PGHOST -p $PGPORT" -w start

psql -X -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA hello;'
```

`PGHOST`, `PGPORT`, `PGDATABASE`, and `PGUSER` tell `psql` where to connect. `DATABASE_URL` passes the same connection to the Go app; despite the variable's name, its value here is a PostgreSQL key/value DSN.

The schema is created separately because `pgmigrate` creates its bookkeeping tables, not the application schema.

The exit trap stops the server and removes the temporary files if the shell exits early. You can also run the [cleanup step](#8-clean-up) explicitly. While the demo is running, PostgreSQL's startup log is at `$demo/postgres.log`.

## 2. Create the app and its first migration

The app uses a dedicated two-connection migration pool and closes it when startup finishes. It does not need a migration-direction setting: the embedded files determine its target.

```bash
mkdir -p "$demo/app/migrations"

cat > "$demo/app/main.go" <<'GO'
package main

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"os"

	_ "github.com/lib/pq"
	"github.com/nhost/nhost/internal/lib/pgmigrate"
)

//go:embed migrations/*.sql
var migrations embed.FS

var release = "dev"

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() (err error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("set DATABASE_URL before starting the app")
	}

	database, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("opening migration database: %w", err)
	}
	defer func() {
		if closeErr := database.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing migration database: %w", closeErr))
		}
	}()
	database.SetMaxOpenConns(2)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelWarn,
	}))
	if err := pgmigrate.Migrate(
		context.Background(), logger, database, migrations, "migrations", "hello",
	); err != nil {
		return fmt.Errorf("migrating hello schema: %w", err)
	}

	fmt.Printf("Hello from %s!\n", release)
	return nil
}
GO

cat > "$demo/app/migrations/1_create_greetings.up.sql" <<'SQL'
CREATE TABLE hello.greetings (
    id integer PRIMARY KEY,
    message text NOT NULL
);
INSERT INTO hello.greetings (id, message) VALUES (1, 'Hello, world!');
SQL

cat > "$demo/app/migrations/1_create_greetings.down.sql" <<'SQL'
DROP TABLE hello.greetings;
SQL

go build -ldflags='-X main.release=v1' -o "$demo/hello-v1" "$demo/app"
```

At this point, only migration 1 exists. `hello-v1` cannot contain migrations 2 or 3: you have not written them yet. The `release` string only labels the app's output; it does not select the database version.

Define a helper to inspect the application table and current migration state after each run:

```bash
inspect() {
  psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT * FROM hello.greetings ORDER BY id;
SELECT version, dirty FROM hello.schema_migrations;
SQL
}

"$demo/hello-v1"
inspect
```

Expected output:

```text
Hello from v1!
 id |    message
----+---------------
  1 | Hello, world!
(1 row)

 version | dirty
---------+-------
       1 | f
(1 row)
```

Version `1` and `dirty = f` mean migration 1 completed successfully. Its SQL has also been saved in `hello.schema_migration_catalog`.

## 3. Upgrade to v2

Add a second migration. Its down script restores the original greeting and removes the new column.

```bash
cat > "$demo/app/migrations/2_add_language.up.sql" <<'SQL'
ALTER TABLE hello.greetings ADD COLUMN language text NOT NULL DEFAULT 'en';
UPDATE hello.greetings SET message = 'Hello, migrations!' WHERE id = 1;
SQL

cat > "$demo/app/migrations/2_add_language.down.sql" <<'SQL'
UPDATE hello.greetings SET message = 'Hello, world!' WHERE id = 1;
ALTER TABLE hello.greetings DROP COLUMN language;
SQL

go build -ldflags='-X main.release=v2' -o "$demo/hello-v2" "$demo/app"

"$demo/hello-v2"
inspect
```

Expected output:

```text
Hello from v2!
 id |      message       | language
----+--------------------+----------
  1 | Hello, migrations! | en
(1 row)

 version | dirty
---------+-------
       2 | f
(1 row)
```

Starting v2 ran migration 2 automatically. Migration 1 was checked against the catalog, not run again.

## 4. Upgrade to v3

The third migration adds a row. Its down script removes only that row.

```bash
cat > "$demo/app/migrations/3_add_spanish_greeting.up.sql" <<'SQL'
INSERT INTO hello.greetings (id, message, language)
VALUES (2, 'Hola, mundo!', 'es');
SQL

cat > "$demo/app/migrations/3_add_spanish_greeting.down.sql" <<'SQL'
DELETE FROM hello.greetings WHERE id = 2;
SQL

go build -ldflags='-X main.release=v3' -o "$demo/hello-v3" "$demo/app"

"$demo/hello-v3"
inspect
```

Expected output:

```text
Hello from v3!
 id |      message       | language
----+--------------------+----------
  1 | Hello, migrations! | en
  2 | Hola, mundo!       | es
(2 rows)

 version | dirty
---------+-------
       3 | f
(1 row)
```

Now inspect the catalog. It contains SQL for all three versions, including their down scripts:

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT version, identifier, octet_length(down_sql) > 0 AS saved_down_sql
FROM hello.schema_migration_catalog
ORDER BY version;
SQL
```

```text
 version |      identifier      | saved_down_sql
---------+----------------------+----------------
       1 | create_greetings     | t
       2 | add_language         | t
       3 | add_spanish_greeting | t
(3 rows)
```

The catalog saves exact SQL bytes and checksums. That is what lets a compatible older build undo a migration absent from its own bundle.

## 5. Delete the source files and roll back to v2

Remove the generated app source directory. This deletes **every source SQL file**, but leaves the three compiled binaries and PostgreSQL data intact:

```bash
rm -r -- "$demo/app"

"$demo/hello-v2"
inspect
```

Expected output:

```text
Hello from v2!
 id |      message       | language
----+--------------------+----------
  1 | Hello, migrations! | en
(1 row)

 version | dirty
---------+-------
       2 | f
(1 row)
```

The Spanish row is gone. `hello-v2` still embeds migrations 1 and 2, but it was built **before migration 3 existed**. It read migration 3's saved down SQL from PostgreSQL and executed it to reach its own target, version 2.

There was no separate rollback command, and no copy of `3_add_spanish_greeting.down.sql` was supplied to the older build.

## 6. Roll back to v1

Run the original binary:

```bash
"$demo/hello-v1"
inspect
```

Expected output:

```text
Hello from v1!
 id |    message
----+---------------
  1 | Hello, world!
(1 row)

 version | dirty
---------+-------
       1 | f
(1 row)
```

The language column has disappeared and the original message is back. `hello-v1` embeds only migration 1; migration 2's down SQL came from the database.

The retired migrations are retained as archived history:

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT version, identifier, archived_at IS NOT NULL AS archived
FROM hello.schema_migration_catalog
ORDER BY version;
SQL
```

```text
 version |      identifier      | archived
---------+----------------------+----------
       1 | create_greetings     | f
       2 | add_language         | t
       3 | add_spanish_greeting | t
(3 rows)
```

`f` means migration 1 remains active; `t` means migrations 2 and 3 are archived. Their SQL has not been deleted. Only active rows define the current migration chain.

## 7. Try starting the same build again

```bash
"$demo/hello-v1"
inspect
```

You should see the same output as step 6. The database already matches v1, so no migration SQL is replayed.

You can also start `hello-v3` again to upgrade back to version 3, even with the source directory deleted: that binary embeds all three migrations. Re-publishing retired migrations creates new active catalog rows while keeping the archived history, so the catalog can then contain multiple rows for a version.

## 8. Clean up

Stop the disposable server before removing its data and binaries:

```bash
cleanup
trap - EXIT
unset DATABASE_URL PGDATA PGHOST PGPORT PGDATABASE PGUSER
```

If you entered the Nix shell for this tutorial, `exit` returns to your previous shell.

## What to take into a real service

- Call `Migrate` during startup with the build's embedded filesystem. Use a separate migration pool, not the pool that serves application requests.
- Keep applied migration files unchanged across builds. SQL saved in the database does not make incompatible migration histories interchangeable.
- Let only one release version migrate a database at a time. The sequential runs here are deliberate; running v1 and v3 migration callers together can alternate the database between their targets.
- Both sides of a rollback must use `pgmigrate`. A build from before adoption cannot read the catalog.
- The demo's down SQL restores its small example exactly. Real down migrations may lose data or fail; take backups, review reversals, and use the [recovery guide](RECOVERY.md) for failures rather than resetting migration state blindly.
