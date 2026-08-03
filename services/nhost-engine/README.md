# nhost-engine

`nhost-engine` runs the Nhost Go services — **auth**, **storage**, and
**graphql** (the constellation GraphQL engine) — in a **single process** behind
**one shared listener**, each mounted under its own path prefix. It exists so a
deployment can co-host these services without running (and networking) a
separate container per service.

The engine is intended to **replace** the individual `auth`, `storage`, and
`constellation` binaries: `nhost-engine serve` runs all of them, configured
through one flag surface.

## Command grammar

```
nhost-engine serve [options]
```

`serve` runs every service by default. Use `--disable-<service>` to leave one
out:

```sh
# run everything on the default port
nhost-engine serve

# run everything but storage, on a custom port, with shared secrets
nhost-engine serve \
  --bind :8080 \
  --admin-secret "$ADMIN_SECRET" \
  --jwt-secret "$JWT_SECRET" \
  --disable-storage

# a per-service option, e.g. auth's client URL
nhost-engine serve --auth-client-url https://app.example.com
```

`nhost-engine --help` lists the top-level commands; `nhost-engine serve --help`
lists every flag, grouped into the shared globals and each service's prefixed
options.

## Services and routing

Every enabled service is mounted under a path prefix on the shared listener;
the prefix is stripped before the request reaches the service, so each service
keeps serving its own native paths.

| Service   | Prefix      | Example request        | Reaches the service as |
|-----------|-------------|------------------------|------------------------|
| auth      | `/auth`     | `/auth/v1/signin/...`  | `/v1/signin/...`       |
| storage   | `/storage`  | `/storage/v1/files`    | `/v1/files`            |
| graphql   | `/graphql`  | `/graphql/v1`          | `/v1`                  |

The engine also serves `GET /healthz` for liveness.

## Configuration

Configuration is split into **global flags** — the settings common to every
service, set once — and **prefixed flags** — each service's remaining options,
namespaced under its service name.

### Global flags

Process-level settings configure the engine directly and use bare env vars:

| Flag | Env | Default | Purpose |
|------|-----|---------|---------|
| `--bind` | `BIND` | `:8080` | shared listener address |
| `--debug` | `DEBUG` | `false` | debug logging |
| `--log-format-text` | `LOG_FORMAT_TEXT` | `false` | human-friendly logs instead of JSON |
| `--http-read-timeout` | `HTTP_READ_TIMEOUT` | `30s` | shared server read timeout |
| `--http-write-timeout` | `HTTP_WRITE_TIMEOUT` | `5m` | shared server write timeout |
| `--http-idle-timeout` | `HTTP_IDLE_TIMEOUT` | `120s` | shared server idle timeout |
| `--disable-auth` | `DISABLE_AUTH` | `false` | do not run auth |
| `--disable-storage` | `DISABLE_STORAGE` | `false` | do not run storage |
| `--disable-graphql` | `DISABLE_GRAPHQL` | `false` | do not run graphql |

Cross-cutting values are set once and injected into each service that consumes
them:

| Flag | Env | Applies to |
|------|-----|------------|
| `--admin-secret` | `ADMIN_SECRET` | auth, storage, graphql |
| `--jwt-secret` | `JWT_SECRET` | auth, graphql |
| `--database-url` | `DATABASE_URL` | auth, graphql |
| `--migrations-database-url` | `MIGRATIONS_DATABASE_URL` | auth, storage |
| `--cors-allowed-origins` | `CORS_ALLOWED_ORIGINS` | storage, graphql |

### Prefixed (per-service) flags

Every remaining service option is re-exposed under its service prefix, with a
matching env var: `--auth-*` / `AUTH_*`, `--storage-*` / `STORAGE_*`, and
`--graphql-*` / `GRAPHQL_*`. For example auth's `--client-url` becomes
`--auth-client-url` (`AUTH_CLIENT_URL`). These are forwarded verbatim to the
service's own CLI, which keeps authority over their types, defaults, and
validation. Low-level tuning flags are accepted but hidden from `--help`.

### Precedence

A global value is injected into a service flag **only when the service did not
set that flag itself** — via its prefixed flag or its own env var. So an
explicit per-service value always wins; the global only fills the gaps. This
lets you set what is genuinely common once (e.g. `ADMIN_SECRET`) while still
overriding a single service where needed.

> Note: each service's own `--port` / `--bind` / `--debug` flags are not
> re-exposed — the shared listener and shared logger govern instead.

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

See [`DESIGN.md`](DESIGN.md) for the flag-model rationale, the full config
mapping, router composition, and the phased implementation plan.
