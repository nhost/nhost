# SQLite source differences

Constellation exposes SQLite databases through the same Hasura-compatible GraphQL
metadata model used for PostgreSQL sources where SQLite can support the same
semantics. Some PostgreSQL features have no SQLite equivalent; this page records
the customer-visible differences that follow from those limits.

## SQLite inserts and upserts

Tracked SQLite tables may still advertise `insert`, `insert_one`, nested insert,
and `on_conflict` fields because schema generation currently shares the
PostgreSQL mutation surface. The generated insert/upsert SQL is not executable
against SQLite yet.

The current insert pipeline wraps mutations in data-modifying CTEs such as
`WITH ... AS (INSERT ... RETURNING *)`, a PostgreSQL shape that SQLite rejects.
As a result, the non-admin upsert permission behavior documented for PostgreSQL
is not available for SQLite sources. Treat SQLite `insert`, `insert_one`, nested
inserts, and `ON CONFLICT` upserts as unsupported until the SQLite insert
pipeline is implemented; this matches the feature matrix in
[PostgreSQL features](postgres-features.md#feature-support-matrix).

Use PostgreSQL sources when clients need Hasura-compatible insert/upsert
permissions. If you keep a SQLite source, do not rely on the generated SQLite
insert or upsert mutation fields for client writes.
