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

### With an Nhost project (recommended)

The lowest-friction way to try Constellation is to enable it on an Nhost project — local or cloud — via the `nhost.toml`. Add to `nhost/nhost.toml` either locally or in your cloud project's configuration editor:

```toml
[experimental.constellation]
version = "0.2.1"
```

Pick the latest tag from [`CHANGELOG.md`](./CHANGELOG.md) — we recommend always running the latest. With this in place, an Nhost project runs Hasura and Constellation side by side:

- `https://<subdomain>.hasura.<region>.nhost.run` — routed to Hasura (metadata authoring, plus anything Constellation doesn't serve yet).
- `https://<subdomain>.graphql.<region>.nhost.run` — routed to Constellation.

Because both engines share the same database and metadata, you can flip Constellation on to try it, run real traffic through it, and remove the block to fall back to Hasura at any time. While it's running, the schema-diff workflow in [Compatibility](#verifying-compatibility-against-your-hasura-instance) lets you confirm the two endpoints produce equivalent schemas per role.

All available settings under `[experimental.constellation]`:

```toml
[experimental.constellation]
# Constellation image tag. Available versions:
# https://github.com/nhost/nhost/blob/main/services/constellation/CHANGELOG.md
version = "0.2.1"

[experimental.constellation.settings]
# CORS allowed origins. If set, used as-is.
# If unset, origins are derived from auth.redirections.clientUrl and
# auth.redirections.allowedUrls (paths/queries/fragments stripped).
# Entries may use "*" as a wildcard matching any run of characters
# (e.g. "https://my-app-*-org.vercel.app"). A bare "*" cannot be combined
# with credentials and is rejected at startup.
corsAllowedOrigins = []

# Enable debug logging.
debug = false

# Return raw connector/database error detail to clients instead of the
# sanitized generic message. For development only — never enable in
# production, as it leaks internal schema and data values.
devMode = false

# Polling interval for GraphQL subscriptions.
subscriptionPollInterval = "1s"
```

If you'd rather run Constellation standalone (no Nhost project), keep reading.

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

- **Database mode** — `--metadata-database-url` (or `CONSTELLATION_METADATA_DATABASE_URL`) points at the PostgreSQL database where Hasura stores its `hdb_catalog.hdb_metadata` row. Constellation reads the snapshot at boot, then *owns* it: native `pg_*` mutation ops on `POST /v1/metadata` (e.g. `pg_track_table`, `pg_create_select_permission`, `bulk_atomic`, `replace_metadata`) write back to `hdb_metadata` directly, with optimistic concurrency on `resource_version`, then atomically swap the in-process snapshot and hot-reload the live schema. The legacy poller is intentionally disabled in this mode — the in-process Store is the source of truth, so an external Hasura is no longer required for authoring. Best for Hasura-free Nhost deployments where the Nhost dashboard authors metadata directly.

### Metadata authoring (dashboard parity)

In **database mode** the dashboard's database/permissions/functions/events tabs can target Constellation directly (no Hasura peer). Supported ops:

- **Tables**: `pg_track_table`, `pg_untrack_table` (with `cascade`), `pg_set_table_customization`, `pg_set_table_is_enum`
- **Relationships**: `pg_create_object_relationship`, `pg_create_array_relationship`, `pg_drop_relationship`, `pg_rename_relationship`, `pg_suggest_relationships`, `pg_create_remote_relationship`, `pg_delete_remote_relationship`
- **Permissions**: 8 ops — `pg_{create,drop}_{select,insert,update,delete}_permission` plus `pg_create_function_permission` / `pg_drop_function_permission`
- **Functions**: `pg_track_function`, `pg_untrack_function`, `pg_set_function_customization`
- **Event triggers (config-only)**: `pg_create_event_trigger`, `pg_delete_event_trigger`. The runtime ops (`pg_redeliver_event`, `pg_invoke_event_trigger`, `pg_get_event_logs`, `pg_get_event_by_id`) return `not-supported` until event delivery ships.
- **Reads**: `pg_get_viewdef`, `pg_suggest_relationships`
- **Snapshot**: `replace_metadata`, `clear_metadata`, `reload_metadata`
- **Wrappers**: `bulk`, `bulk_atomic` (single RV bump, atomic rollback), `bulk_keep_going`

The event delivery **runtime** ops (`pg_redeliver_event`, `pg_invoke_event_trigger`, `pg_get_event_logs`, `pg_get_event_by_id`) are always handled natively and always return `not-supported` — they are *never* forwarded to the proxy, even when `--hasura-upstream-url` is configured.

What constellation has **no** native handler for falls through to the Hasura upstream when `--hasura-upstream-url` is configured (else returns `not-supported`): source admin (`pg_add_source` / `pg_drop_source` / `pg_update_source`; sources are config-driven), computed fields, inherited roles, Apollo Federation. `hasura-cli` migration workflows are out of scope.

#### Smoke test

After `make dev-env-integration-up && make run-up-dbsource`, the in-tree script exercises the dashboard's primary ops via `curl`:

```bash
./scripts/smoke_dashboard_parity.sh
```

It prints one line per op (HTTP status + first 200 chars of body). A regression shows up as a non-2xx status, a 400 error body carrying a `"code"` field, or a 200 body whose `"message"` is anything other than `"success"` or the expected idempotency outcomes (`"already-tracked"`, `"already-exists"`).

#### Manual dashboard verification

The automated smoke test does not click through tabs. To verify dashboard interactivity:

1. `make dev-env-integration-up && make run-up-dbsource`
2. Run the nhost dashboard locally (see `dashboard/README.md`) with `NEXT_PUBLIC_NHOST_HASURA_API_URL=http://localhost:8000` (or equivalent project env).
3. Walk the tabs: Database (create table → modify → add row), Relationships (object + array), Permissions (each verb), Functions, Events (config tab only — “Redeliver” is expected to error), Remote Relationships, Settings → Reload Metadata.
4. Restart constellation; confirm everything survives (snapshot is in `hdb_metadata`).

Known gaps surfaced by manual testing should be logged against the dashboard-parity ticket.

#### Automated parity tests (Hasura vs Constellation)

`integration/metadata_parity_test.go` applies each authoring op to **both** a
real Hasura and Constellation and asserts the results are equivalent (response
code, normalized `export_metadata`, and — for surface-changing ops, opt-in via
`PARITY_SCHEMA_CHECK=1` — the GraphQL SDL delta). It runs Constellation against an
isolated `cstl` metadata DB so the two engines don't fight over `hdb_metadata`:

```bash
make dev-env-integration-up && make build-docker-image && make parity-env-up
cd integration && go test -run TestMetadataParity -v ./...
make parity-env-down
```

See [`docs/user/hasura-metadata-support.md`](./docs/user/hasura-metadata-support.md#metadata-authoring-parity-tests)
for how the comparison layers and metadata normalization work.

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
| `--cors-allowed-origins` | `CONSTELLATION_CORS_ALLOWED_ORIGINS` | *(empty — denies all cross-origin requests)*; entries may use `*` as a wildcard (e.g. `https://my-app-*-org.vercel.app`); a bare `*` cannot be combined with credentials and is rejected at startup |
| `--subscription-poll-interval` | `CONSTELLATION_SUBSCRIPTION_POLL_INTERVAL` | `1s` |
| `--graphql-request-body-limit-bytes` | `CONSTELLATION_GRAPHQL_REQUEST_BODY_LIMIT_BYTES` | `10485760` (10 MiB) |
| `--http-read-timeout` | `CONSTELLATION_HTTP_READ_TIMEOUT` | `30s` — caps request header/body read time |
| `--http-write-timeout` | `CONSTELLATION_HTTP_WRITE_TIMEOUT` | `5m0s` |
| `--http-idle-timeout` | `CONSTELLATION_HTTP_IDLE_TIMEOUT` | `2m0s` |
| `--enable-playground` | `CONSTELLATION_ENABLE_PLAYGROUND` | `false` |
| `--debug` | `CONSTELLATION_DEBUG` | `false` |
| `--log-format-text` | `CONSTELLATION_LOG_FORMAT_TEXT` | `false` — JSON logs by default |
| `--dev-mode` | `CONSTELLATION_DEV_MODE` | `false` — returns raw connector errors; never enable in production |
| `--hasura-upstream-url` | `CONSTELLATION_HASURA_UPSTREAM_URL` | `http://hasura-service:8080/` — proxies unimplemented Hasura-compatible routes to the Nhost sidecar by default; set to an empty string for standalone deployments with no upstream |
| `--profile-address` | `CONSTELLATION_PROFILE_ADDRESS` | *(unset)* — enables `net/http/pprof` |

## Compatibility

Constellation aims to be a drop-in replacement for Hasura on the GraphQL request path. There are a small number of intentional concessions where Hasura's behaviour is surprising or incorrect — these are listed in [`KNOWN_DIFFERENCES.md`](./KNOWN_DIFFERENCES.md). Examples:

- Aggregation support is discovered from PostgreSQL rather than hardcoded — types Hasura excludes (e.g. `bool`, `jsonb`, `bytea`, `vector`) may now appear in `_min`/`_max` aggregates if the database supports them.
- Update mutations are not generated for tables where the role has no update column permissions (Hasura emits no-op mutations).
- Functions returning a single row don't expose `where`/`order_by`/`limit` or an `_aggregate` field (aggregating over exactly one row is meaningless).

### Verifying compatibility against your Hasura instance

If you run Hasura and Constellation side-by-side against the same database, you can confirm Constellation generates the schema you expect by introspecting both and diffing the SDL per role. The `nhost schema dump` and `nhost schema diff` subcommands (in the Nhost CLI) do exactly that (make sure you are running latest nhost cli version):

```bash
#!/bin/bash
set -euo pipefail

DST_PATH="./schemas"

mkdir -p "$DST_PATH"

SUBDOMAIN="local"
REGION="local"
ADMIN_SECRET="nhost-admin-secret"

ROLES=(admin user public)

HASURA_URL="https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql"
CONSTELLATION_URL="https://${SUBDOMAIN}.graphql.${REGION}.nhost.run/v1/graphql"

for role in "${ROLES[@]}"; do
    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${HASURA_URL}" -o "${DST_PATH}/schema.hasura.${role}.graphqls"

    nhost schema dump \
        --role "${role}" --admin-secret "${ADMIN_SECRET}" \
        -u "${CONSTELLATION_URL}" -o "${DST_PATH}/schema.nhost.${role}.graphqls"

    nhost schema diff \
        -a "${DST_PATH}/schema.hasura.${role}.graphqls" \
        -b "${DST_PATH}/schema.nhost.${role}.graphqls" > "${DST_PATH}/schema.${role}.diff"
done
```

If you've linked a project with `nhost link`, you can drop `--url` / `--admin-secret` entirely and just pass `--role` (and optionally `--subdomain` to target a cloud project instead of the local stack).

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

## License

See [`LICENSE`](../../LICENSE) at the repository root.
