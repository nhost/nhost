# Constellation

Constellation is a GraphQL engine that turns relational databases into a role-based GraphQL API. It is a near-drop-in replacement for [Hasura](https://hasura.io/) Community Edition: it speaks the same metadata format, generates Hasura-compatible schemas, and serves the same query/mutation/subscription surface — including remote schemas and cross-source relationships.

## Status

**Alpha — but the core is production-grade.** The PostgreSQL path is battle-tested and already running production workloads at Nhost. The "alpha" label reflects feature coverage versus Hasura, not stability of what's there.

What this means in practice:

- **Stable**: the SQL connectors (PostgreSQL, SQLite), GraphQL query/mutation/subscription pipeline, JWT/admin-secret auth, role-based permissions, remote schemas, and cross-source remote relationships. These have integration tests against real databases and are in production.
- **Missing**: anything outside the GraphQL request path — Hasura Actions, event/cron triggers, REST endpoints, allowlists, query collections, inherited roles, native queries, computed fields, MSSQL/BigQuery/Snowflake. See [`docs/user/hasura-metadata-support.md`](./docs/user/hasura-metadata-support.md) for the full map of what's parsed vs. dropped.
- **Required alongside Hasura today**: Constellation does not yet implement the Hasura Metadata HTTP API (`POST /v1/metadata`). It consumes metadata only — either from a YAML/JSON file on disk or by polling Hasura's `hdb_catalog.hdb_metadata` table. The typical deployment runs Hasura for metadata management and Constellation for query serving, with both pointing at the same database. See [Runtime modes](#runtime-modes).

## Performance

Even without a dedicated optimisation pass, production workloads show Constellation is **slightly faster than Hasura at a fraction of the resources** — we're seeing **90–95% reduction in memory usage** in real production deployments while serving the same traffic. CPU is comparable to marginally lower. This is before any of the performance-focused work on the roadmap.

The headline numbers come mostly from architectural choices that fall out of writing this in Go from scratch:

- A raw-bytes response fast path that skips JSON re-serialisation when SQL connectors return raw JSON.
- An LRU cache of parsed/validated GraphQL queries, keyed per role.
- Multiplexed subscription polling that batches subscribers with identical queries into single SQL polls (cohort model).
- Lock-free atomic state swap on metadata reload, so request handlers never block on configuration changes.

## Goals

1. **Drop-in compatibility with Hasura** for everything that runs on the GraphQL request path. Same metadata format, same generated schema, same query/mutation/subscription semantics. A handful of small concessions exist for correctness — see [`KNOWN_DIFFERENCES.md`](./KNOWN_DIFFERENCES.md).
2. **Predictable, low resource footprint.** A GraphQL engine should not be the most expensive thing in your stack.
3. **Multiple database backends.** PostgreSQL and SQLite are first-class today; the `Driver` and `Dialect` interfaces are designed so additional engines can plug in without touching the query planner.
4. **Correctness over surface area.** When a Hasura behaviour is wrong or surprising, we'd rather diverge than reproduce it. Divergences are documented.
5. **Approachable codebase.** Heavy use of small interfaces, golden-file tests, and per-package documentation. New contributors should be able to read one subpackage and ship a change without spelunking through the rest.

## How it relates to Hasura

```
                    ┌────────────────────┐
                    │ metadata.yaml /    │
                    │ hdb_catalog.       │     polled or file-watched
                    │ hdb_metadata       │
                    └──────────┬─────────┘
                               │
                               ▼
┌─────────────────────┐   ┌────────────────────┐
│ Hasura              │   │ Constellation      │
│ (metadata CLI/UI)   │   │ (GraphQL serving)  │
└──────────┬──────────┘   └─────────┬──────────┘
           │                        │
           ▼                        ▼
              ┌──────────────────────────┐
              │     PostgreSQL / SQLite  │
              └──────────────────────────┘
```

Hasura owns metadata authoring; Constellation owns request serving. Both speak to the same database. Once Constellation supports metadata mutations on its own, the Hasura half can be dropped.

## Quick start

### Prerequisites

- [Nix](https://nixos.org/download) (recommended — pins every tool we use).
- Docker (for the dev database).
- A running Hasura instance pointed at the same database for metadata management, *or* a checked-in `metadata.yaml`.

Enter the dev shell — this gives you Go, PostgreSQL client, SQLite, Hasura CLI, mockgen, and friends:

```bash
nix develop
```

### Build

```bash
make build                  # produces ./result/bin/constellation
```

Or directly with Go (requires `CGO_ENABLED=1` for SQLite):

```bash
CGO_ENABLED=1 go build -o constellation ./
```

### Run

The minimum to get an instance up:

```bash
./result/bin/constellation serve \
  --metadata-path /path/to/metadata/ \
  --admin-secret 'change-me' \
  --jwt-secret '{"type":"HS256","key":"..."}' \
  --enable-playground
```

Then open <http://localhost:8000/> for the GraphQL playground or POST to <http://localhost:8000/v1/graphql>. Subscriptions are served over WebSocket on the same endpoint (`graphql-transport-ws` protocol).

### Runtime modes

Two things are sourced separately and shouldn't be confused:

**Data sources** — the user-data PostgreSQL databases the GraphQL API serves over. They are *never* configured on the CLI; each one is declared inside the metadata under `sources[].configuration.connection_info` (Hasura's source format). Constellation opens a connection pool per source at startup and reuses it for every request.

**Metadata** — the definitions of those sources, plus tables, permissions, relationships, and remote schemas. You pick exactly one of:

- **File mode** — `--metadata-path` (or `CONSTELLATION_METADATA_PATH`) points at a single `.toml` file or at any path inside a Hasura v3 YAML metadata directory (for the YAML case the file you name is not opened; only its parent directory is read per the Hasura layout). Metadata is loaded **once at startup**. There is no file watcher, no polling, and no fallback sync from a database — restart constellation to pick up changes. Best for static deployments and CI.

- **Database mode** — `--metadata-database-url` (or `CONSTELLATION_METADATA_DATABASE_URL`) points at the PostgreSQL database where Hasura stores its `hdb_catalog.hdb_metadata` row. Constellation polls that row's `resource_version` every second; when it changes, the blob is re-read and the live schema is hot-swapped atomically (in-flight requests complete against the old state; new requests see the new one). Best for deployments where Hasura still owns metadata authoring.

The modes are mutually exclusive. File mode does not refresh from any database; database mode ignores `--metadata-path`. The metadata DB (`--metadata-database-url`) is also distinct from the data sources declared inside the metadata — pointing it at a data DB would only work if that DB happened to host Hasura's `hdb_catalog` schema.

### Local development environment

For end-to-end testing against a real Nhost stack (Hasura + auth + storage + PostgreSQL), spin up the integration environment via the Nhost CLI:

```bash
make dev-env-integration-up   # `nhost up --apply-seeds` inside ./integration
make dev-env-integration-down
```

To also build a constellation Docker image and run it alongside the integration stack (binds `:8000`, plus a side PostgreSQL 18 container on `:5433` for ad-hoc experimentation):

```bash
make dev-env-up      # build image + integration stack + constellation container
make dev-env-down    # tear everything down (volumes deleted)
```

### Configuration reference

All flags are also available as environment variables. The most common:

| Flag | Env | Default |
|---|---|---|
| `--bind-address` | `CONSTELLATION_BIND_ADDRESS` | `:8000` |
| `--metadata-path` | `CONSTELLATION_METADATA_PATH` | `./metadata/metadata.yaml` |
| `--metadata-database-url` | `CONSTELLATION_METADATA_DATABASE_URL` | *(unset → file mode)* |
| `--admin-secret` | `CONSTELLATION_ADMIN_SECRET` | *(required)* |
| `--jwt-secret` | `CONSTELLATION_JWT_SECRET` | *(required)* |
| `--cors-allowed-origins` | `CONSTELLATION_CORS_ALLOWED_ORIGINS` | *(empty — denies all cross-origin requests)* |
| `--subscription-poll-interval` | `CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL` | `1s` |
| `--enable-playground` | `CONSTELLATION_ENABLE_PLAYGROUND` | `false` |
| `--debug` | `CONSTELLATION_DEBUG` | `false` |
| `--log-format-text` | `CONSTELLATION_LOG_FORMAT_TEXT` | `false` — JSON logs by default |
| `--dev-mode` | `CONSTELLATION_DEV_MODE` | `false` — returns raw connector errors; never enable in production |
| `--profile-address` | `CONSTELLATION_PROFILE_ADDRESS` | *(unset)* — enables `net/http/pprof` |

## Compatibility

Constellation aims to be a drop-in replacement for Hasura on the GraphQL request path. There are a small number of intentional concessions where Hasura's behaviour is surprising or incorrect — these are listed in [`KNOWN_DIFFERENCES.md`](./KNOWN_DIFFERENCES.md). Examples:

- Aggregation support is discovered from PostgreSQL rather than hardcoded — types Hasura excludes (e.g. `bool`, `jsonb`, `bytea`, `vector`) may now appear in `_min`/`_max` aggregates if the database supports them.
- Update mutations are not generated for tables where the role has no update column permissions (Hasura emits no-op mutations).
- Functions returning a single row don't expose `where`/`order_by`/`limit` or an `_aggregate` field (aggregating over exactly one row is meaningless).

### Verifying compatibility against your Hasura instance

If you run Hasura and Constellation side-by-side against the same database, you can confirm Constellation generates the schema you expect by introspecting both and diffing the SDL per role. The `schema dump` and `schema diff` subcommands do exactly that:

```bash
#!/bin/bash
set -euo pipefail

ROLES=(admin user public)
HASURA_URL="https://your-hasura-endpoint/v1"
NHOST_URL="http://your-constellation-endpoint/v1/graphql"
ADMIN_SECRET="your-admin-secret"

for role in "${ROLES[@]}"; do
    constellation schema dump \
        -H "X-Hasura-Role: ${role}" \
        -H "X-Hasura-Admin-Secret: ${ADMIN_SECRET}" \
        -o "./schema.hasura.${role}.graphqls" \
        -u "${HASURA_URL}"

    constellation schema dump \
        -H "X-Hasura-Role: ${role}" \
        -H "X-Hasura-Admin-Secret: ${ADMIN_SECRET}" \
        -o "./schema.nhost.${role}.graphqls" \
        -u "${NHOST_URL}"

    constellation schema diff \
        -a "schema.hasura.${role}.graphqls" \
        -b "schema.nhost.${role}.graphqls" > "schema.${role}.diff"
done
```

An empty `schema.<role>.diff` means Constellation generated a byte-equivalent schema for that role. If a diff is non-empty, every hunk should map to one of the categories in [`KNOWN_DIFFERENCES.md`](./KNOWN_DIFFERENCES.md). If you find a divergence that isn't covered there, please [open an issue](https://github.com/nhost/nhost/issues/new) with the affected diff hunk and a minimal metadata snippet — that's how new categories get documented (or fixed).

For the full picture of what Hasura metadata Constellation supports, see [`docs/user/hasura-metadata-support.md`](./docs/user/hasura-metadata-support.md).

## Documentation

User-facing:

- [`docs/user/hasura-metadata-support.md`](./docs/user/hasura-metadata-support.md) — every Hasura metadata field, supported / partial / ignored / unsupported.
- [`docs/user/postgres-features.md`](./docs/user/postgres-features.md) — PostgreSQL feature matrix and metadata reference.
- [`docs/user/remote-schema.md`](./docs/user/remote-schema.md) — remote schema configuration, `@preset`, header forwarding.

Developer / contributor:

- [`docs/developers/query-execution.md`](./docs/developers/query-execution.md) — end-to-end request pipeline.
- [`docs/developers/remote-relationships.md`](./docs/developers/remote-relationships.md) — planner/resolver mechanics.
- [`docs/developers/subscriptions.md`](./docs/developers/subscriptions.md) — WebSocket protocol, cohort multiplexing, stream cursors.
- [`docs/developers/remote-schemas.md`](./docs/developers/remote-schemas.md) — introspection, SDL parsing, HTTP forwarding.
- [`docs/developers/customization.md`](./docs/developers/customization.md) — schema customization (namespaces, prefixes/suffixes, type renames) as a connector decorator.
- [`docs/developers/architecture.md`](./docs/developers/architecture.md) — atomic state swap, auth precedence, fast paths, concurrency model.
- [`CLAUDE.md`](./CLAUDE.md) — project conventions and code-review guidelines.

Each Go package also has a `doc.go` or top-of-file package godoc — `go doc github.com/nhost/nhost/services/constellation/...` is your friend.

## Testing

```bash
go test ./connector/... ./controller/... ./metadata/...     # unit tests
CGO_ENABLED=1 go test ./connector/sql/sqlite/...            # SQLite (needs CGO)
make dev-env-integration-up
go test ./integration/...                                   # end-to-end
```

Many packages use golden files in `testdata/`. Regenerate with the `-update` flag when you intentionally change generated SQL or schemas:

```bash
go test ./connector/sql/graphql/queries/... -update
```

## Contributing

Patches welcome. Before opening a PR:

1. Run `golines -w --base-formatter=gofumpt .` and `golangci-lint run --fix ./...` from the repo root.
2. Add tests — public symbols need black-box coverage; complex unexported logic gets white-box tests.
3. Update goldens with `-update` if you intentionally changed generated output.
4. See [`CLAUDE.md`](./CLAUDE.md) for the full project conventions and Go package design rules.

## Roadmap

### Shipped

- GraphQL generation from database schema
- CRUD operations, row permissions and presets, role-based access
- Relationships, aggregations, custom scalars, enum types
- PostgreSQL functions
- Subscriptions, including `_stream`
- Multi-database (independent queries and cross-database remote relationships)
- Remote schemas with cross-source remote relationships
- JWT auth (symmetric, asymmetric, JWKS, `claims_map`) and admin secret
- Metadata loading from file or polled from `hdb_catalog.hdb_metadata`

### Pre-1.0

- Test coverage and benchmark comparisons against Hasura
- Metrics and structured logging surface
- Computed fields
- Views (read fully supported today; first-class metadata configuration is open)
- Database events / triggers
- Pre / post-mutation checks beyond the SQL `check` clause
- Persistent queries / allowlists
- Metadata Management HTTP API (to drop the Hasura dependency)
- Subscription revisit (correctness + performance pass)
- Removing the admin-secret path from the WebSocket handler in favour of JWT-only
- MySQL support (under consideration)

## License

See [`LICENSE`](../../LICENSE) at the repository root.
