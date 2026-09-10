# pg_dump fixtures

Real `pg_dump --schema-only` output used by `TestSanitizeRealPgDumpFixtures` to
verify the `\restrict`/`\unrestrict` stripping against what each Postgres major
actually emits.

The `\restrict <token>` / `\unrestrict <token>` psql meta-commands were added
in the 2025-08 security release (PostgreSQL 18, 17.6, 16.10, 15.14, 14.19,
13.22). Hasura applies migrations over its query API rather than psql, so those
lines fail with `syntax error at or near "\"` — hence the stripping.

- `pg14.sql` .. `pg18.sql` — dumped by pg_dump 14.23 / 15.18 / 16.14 / 17.10 /
  18.4; each contains the directives.
- `pg17_5_norestrict.sql` — dumped by pg_dump 17.5 (pre-2025-08); no directives,
  used as the negative case (must be detected as clean and left untouched).

Regenerate (tokens differ each run; that is fine, the test is content-agnostic):

```sh
for img in postgres:14 postgres:15 postgres:16 postgres:17 postgres:18 postgres:17.5; do
  docker run --rm --user postgres --entrypoint bash "$img" -c '
    export PGDATA=/tmp/d
    initdb -U postgres >/dev/null 2>&1
    pg_ctl -D "$PGDATA" -o "-k /tmp -c listen_addresses=\"\"" -w start >/dev/null 2>&1
    psql -U postgres -h /tmp -q -c "create table public.todos(id uuid not null default gen_random_uuid(), title text not null, created_at timestamptz not null default now());"
    psql -U postgres -h /tmp -q -c "create index todos_title_idx on public.todos(title);"
    pg_dump -U postgres -h /tmp --schema-only --no-owner postgres
    pg_ctl -D "$PGDATA" stop >/dev/null 2>&1'
done
```
