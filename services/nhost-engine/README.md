# nhost-engine

`nhost-engine` runs one or more Nhost Go services — **auth**, **storage**, and
**graphql** (the constellation GraphQL engine) — in a **single process** behind
**one shared listener**, each mounted under its own path prefix. It exists so a
deployment can co-host these services without running (and networking) a
separate container per service.

The standalone `auth`, `storage`, and `constellation` binaries remain fully
supported; the engine is an additional way to run the same code, not a
replacement.

## Command grammar

Services are selected on the command line and separated by `--`. Shared flags
come first, before the first service:

```
nhost-engine [shared flags] SERVICE [service flags] [-- SERVICE [service flags] ...]
```

- At least one service is required (except for top-level `--help` / `--version`).
- A service may appear at most once.
- An optional standalone `--` may terminate the shared flags explicitly
  (`nhost-engine [shared flags] -- auth ...`).

Examples:

```sh
# one service
nhost-engine auth

# all three behind one port, with a shared admin secret and JWT secret
nhost-engine \
  --bind :8080 \
  --admin-secret "$ADMIN_SECRET" \
  --jwt-secret "$JWT_SECRET" \
  auth -- storage -- graphql

# per-service help (does not start anything)
nhost-engine graphql --help
```

## Services and routing

Every selected service is mounted under a path prefix on the shared listener;
the prefix is stripped before the request reaches the service, so each service
keeps serving its own native paths.

| Service   | Prefix      | Example request        | Reaches the service as |
|-----------|-------------|------------------------|------------------------|
| auth      | `/auth`     | `/auth/v1/signin/...`  | `/v1/signin/...`       |
| storage   | `/storage`  | `/storage/v1/files`    | `/v1/files`            |
| graphql   | `/graphql`  | `/graphql/v1`          | `/v1`                  |

The engine also serves `GET /healthz` for liveness.

## Configuration

### Shared flags (`NHOST_*`)

Supplied before the first service. Process-level settings configure the engine
directly:

| Flag | Env | Default | Purpose |
|------|-----|---------|---------|
| `--bind` | `NHOST_BIND` | `:8080` | shared listener address (wins over `--port`) |
| `--port` | `NHOST_PORT` | — | shared listener port; forms `:PORT` when `--bind` is unset |
| `--debug` | `NHOST_DEBUG` | `false` | debug logging |
| `--log-format-text` | `NHOST_LOG_FORMAT_TEXT` | `false` | human-friendly logs instead of JSON |
| `--http-read-timeout` | `NHOST_HTTP_READ_TIMEOUT` | `30s` | shared server read timeout |
| `--http-write-timeout` | `NHOST_HTTP_WRITE_TIMEOUT` | `5m` | shared server write timeout |
| `--http-idle-timeout` | `NHOST_HTTP_IDLE_TIMEOUT` | `120s` | shared server idle timeout |

Cross-cutting values are injected into each service that consumes them:

| Flag | Env | Applies to |
|------|-----|------------|
| `--admin-secret` | `NHOST_ADMIN_SECRET` | auth, storage, graphql |
| `--jwt-secret` | `NHOST_JWT_SECRET` | auth, graphql |
| `--database-url` | `NHOST_DATABASE_URL` | auth, graphql |
| `--migrations-database-url` | `NHOST_MIGRATIONS_DATABASE_URL` | auth, storage |
| `--cors-allowed-origins` | `NHOST_CORS_ALLOWED_ORIGINS` | storage, graphql |

### Precedence

A shared value is injected into a service flag **only when the service did not
set that flag itself** — via a per-service CLI flag or its own env var. So an
explicit per-service value always wins; the shared value only fills the gaps.
This lets you set what is genuinely common once (e.g. `NHOST_ADMIN_SECRET`)
while still overriding a single service where needed.

### Per-service flags

Everything not listed above stays per-service and is passed after that
service's name (or via that service's own env var), exactly as for the
standalone binaries — OAuth providers, SMTP/SMS, S3, image transformer,
metadata source, etc. Run `nhost-engine SERVICE --help` for the full list.

> Note: in engine mode each service's own `--port` / `--bind` / `--debug`
> flags still parse but are ignored — the shared listener and shared logger
> govern instead.

## Build and run

With Nix:

```sh
nix build .#nhost-engine
./result/bin/nhost-engine --help

# docker image
nix build .#nhost-engine-docker-image
```

From the module (needs the engine dev shell for `vips` + `GOEXPERIMENT=jsonv2`):

```sh
nix develop .#nhost-engine
go build ./services/nhost-engine
```

## Docker Compose

See [`build/dev/docker/docker-compose.yaml`](build/dev/docker/docker-compose.yaml)
for an illustrative example that runs all three services behind one port with
Postgres, Hasura, and MinIO as backing services.

## Design

See [`DESIGN.md`](DESIGN.md) for the CLI grammar rationale, the full config
mapping, router composition, and the phased implementation plan.
