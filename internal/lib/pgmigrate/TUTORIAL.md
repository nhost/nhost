# Tutorial: upgrade and roll back a hello-world app

Run two ready-made versions of a small Go app and watch PostgreSQL follow the version you start:

```text
Start v1 → database version 1
Start v2 → database version 2
Start v1 → database version 1 again
```

**v1 does not contain migration 2—not even its down script.** It rolls back using SQL that v2 saved in PostgreSQL.

The apps and SQL are already provided in [`demo/`](demo/). You only need to build them, run them, and inspect the results. No source files need to be created, edited, or deleted.

## Before you start

Start from the **Nhost repository root and keep using the same Bash terminal**. You need Go 1.27 or later and a running local Docker daemon, such as Docker Desktop. PostgreSQL and `psql` run inside the container; no local PostgreSQL installation is needed.

If you use Nix, enter the project's shell for the Go toolchain:

```bash
nix develop .#pgmigrate
```

The demos use Nhost's internal Go package, so build them from this checkout rather than creating a separate Go module.

## 1. Start PostgreSQL

Create a directory for the compiled binaries. This is **not** database storage:

```bash
set -euo pipefail

repo="$PWD"
demo="$repo/.pgmigrate-hello"
mkdir "$demo"

docker run --detach --rm --name pgmigrate-hello \
  --env POSTGRES_PASSWORD=postgres \
  --publish 127.0.0.1::5432 \
  postgres:18

# Wait up to 30 seconds for PostgreSQL's TCP listener.
for attempt in {1..30}; do
  if docker exec pgmigrate-hello pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec pgmigrate-hello pg_isready -h 127.0.0.1 -U postgres

port=$(docker port pgmigrate-hello 5432/tcp | cut -d: -f2)
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:$port/postgres?sslmode=disable"

# Run the following psql commands inside the container.
psql() {
  docker exec -i pgmigrate-hello psql -U postgres -d postgres "$@"
}
psql -X -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA hello;'
```

Docker picks an unused port bound to `127.0.0.1`. No host directory or named volume is mounted for PostgreSQL. Keep the container running throughout the walkthrough; stopping it discards the demo database because of `--rm`.

The schema is created separately because `pgmigrate` creates its migration tables, not the application schema. The password above is only for this disposable local demo.

If you stop partway through, use the [cleanup commands](#7-clean-up). To inspect server logs, run `docker logs pgmigrate-hello`.

## 2. Build the two app versions

The relevant files are:

```text
demo/
├── v1/
│   ├── main.go
│   └── migrations/
│       ├── 1_create_greetings.up.sql
│       └── 1_create_greetings.down.sql
└── v2/
    ├── main.go
    └── migrations/
        ├── 1_create_greetings.up.sql
        ├── 1_create_greetings.down.sql
        ├── 2_add_languages.up.sql
        └── 2_add_languages.down.sql
```

Each app embeds **only its own** migration directory:

```go
//go:embed migrations/*.sql
var migrations embed.FS
```

On startup, each calls `pgmigrate.Migrate` with that filesystem and the `hello` schema. The highest embedded migration determines the target; there is no up/down flag or separate target setting. Both apps use a dedicated, two-connection migration pool and close it after migration finishes.

Build them, then switch to the directory containing just the binaries:

```bash
go build -o "$demo/hello-v1" ./internal/lib/pgmigrate/demo/v1
go build -o "$demo/hello-v2" ./internal/lib/pgmigrate/demo/v2
cd "$demo"
```

Neither binary reads SQL files from disk at runtime. You can read the complete startup code in [`v1/main.go`](demo/v1/main.go) and [`v2/main.go`](demo/v2/main.go).

Migration logs go to stderr. The output blocks below show the app's stdout and the SQL query results.

## 3. Start v1

Define a helper for inspecting the greeting table and current version, then start v1:

```bash
inspect() {
  psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT * FROM hello.greetings ORDER BY id;
SELECT version, dirty FROM hello.schema_migrations;
SQL
}

./hello-v1
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

[Migration 1](demo/v1/migrations/1_create_greetings.up.sql) created the table and inserted its first greeting. `dirty = f` means the migration completed successfully.

## 4. Upgrade to v2

Start the newer app—nothing else is needed to request an upgrade:

```bash
./hello-v2
inspect
```

Expected output:

```text
Hello from v2!
 id |      message       | language
----+--------------------+----------
  1 | Hello, migrations! | en
  2 | Hola, mundo!       | es
(2 rows)

 version | dirty
---------+-------
       2 | f
(1 row)
```

[Migration 2's up script](demo/v2/migrations/2_add_languages.up.sql) added a language column, changed the English message, and inserted a Spanish greeting. Migration 1 is byte-for-byte identical in both apps; it was checked, not replayed.

Before running migration 2, v2 saved its up **and down** SQL in the catalog. Inspect it:

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT version, identifier, octet_length(down_sql) > 0 AS saved_down_sql
FROM hello.schema_migration_catalog
ORDER BY version;
SQL
```

```text
 version |    identifier    | saved_down_sql
---------+------------------+----------------
       1 | create_greetings | t
       2 | add_languages    | t
(2 rows)
```

`saved_down_sql = t` confirms the database has the SQL needed to undo each migration.

## 5. Roll back by starting v1 again

```bash
./hello-v1
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

The original greeting is back, the Spanish row is gone, and the language column has been removed. v1 inferred its own target, version 1, and ran migration 2's down SQL **from PostgreSQL**.

You did not give v1 a rollback command or a new down file. Its [migration directory](demo/v1/migrations/) still contains only migration 1. The checked-in v2 files remain untouched; v1 does not read them.

Inspect the retained history:

```bash
psql -X -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT version, identifier, archived_at IS NOT NULL AS archived
FROM hello.schema_migration_catalog
ORDER BY version;
SQL
```

```text
 version |    identifier    | archived
---------+------------------+----------
       1 | create_greetings | f
       2 | add_languages    | t
(2 rows)
```

Migration 2 is archived, not deleted. Its SQL remains available as history; only unarchived rows form the active migration chain.

## 6. Try another startup

```bash
./hello-v1
inspect
```

You should see the same output as step 5. The database already matches v1, so no migration SQL is replayed.

You can also run `./hello-v2` again to upgrade back to version 2. The catalog will retain the archived migration 2 and register a new active row for it, so its history can contain multiple rows for the same version.

## 7. Clean up

Return to the checkout and stop the disposable database. Docker removes the container and discards its database automatically because of `--rm`. Delete only the generated binaries, leaving `demo/v1` and `demo/v2` unchanged:

```bash
cd "$repo"
docker stop pgmigrate-hello
rm -r -- "$demo"
unset DATABASE_URL
unset -f psql
```

If you entered the Nix shell, `exit` returns to your previous shell.

## What to take into a real service

- Call `Migrate` during startup with the build's embedded migrations and a dedicated migration pool.
- Keep applied migrations unchanged across builds. Saving SQL does not make incompatible migration histories interchangeable.
- Let only one release version migrate a database at a time. Concurrent v1 and v2 migration callers can keep moving it between their targets.
- Both sides of a rollback must use `pgmigrate`; builds from before adoption cannot read the catalog.
- Real down scripts may lose data or fail. Review reversals, take backups, and use the [recovery guide](RECOVERY.md) for failures rather than resetting migration state blindly.
