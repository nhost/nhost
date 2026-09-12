# engine

`engine` runs the Nhost Go services — **auth**, **storage**, and
**graphql** (the constellation GraphQL engine) — in a **single process** behind
**one shared listener**, each mounted under its own path prefix. It exists so a
deployment can co-host these services without running (and networking) a
separate container per service.

The engine is intended to **replace** the individual `auth`, `storage`, and
`constellation` binaries: `engine serve` runs all of them, configured
through one flag surface.

## Command grammar

```
engine serve [options]
```

`serve` runs every service by default. Use `--disable-<service>` to leave one
out:

```sh
# run everything on the default port
engine serve

# run everything but storage, on a custom port, with shared secrets
engine serve \
  --bind :8080 \
  --admin-secret "$ADMIN_SECRET" \
  --jwt-secret "$JWT_SECRET" \
  --disable-storage

# a per-service option, e.g. auth's client URL
engine serve --auth-client-url https://app.example.com
```

`engine --help` lists the top-level commands; `engine serve --help`
lists every flag, grouped into the shared globals and each service's prefixed
options.

## Services and routing

Every enabled service is mounted under a path prefix on the shared listener;
the prefix is stripped before the request reaches the service, so each service
keeps serving its own native paths. Root-relative redirects emitted by a service
have the mount prefix restored, so following them stays within that service's
routes.

| Service   | Prefix      | Example request        | Reaches the service as |
|-----------|-------------|------------------------|------------------------|
| auth      | `/auth`     | `/auth/v1/signin/...`  | `/v1/signin/...`       |
| storage   | `/storage`  | `/storage/v1/files`    | `/v1/files`            |
| graphql   | `/graphql`  | `/graphql/v1`          | `/v1`                  |

Other containers on the same network reach enabled services through these
internal base URLs:

| Service | Internal base URL |
|---------|-------------------|
| auth | `http://engine:8080/auth/v1` |
| storage | `http://engine:8080/storage/v1` |
| graphql | `http://engine:8080/graphql/v1` |

The engine intentionally does not advertise the standalone service aliases
`hasura-auth-service`, `hasura-storage-service`, or `constellation-service`,
because those names imply ports and unprefixed routes that its shared listener
does not serve.

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
validation. No prefixed flags are currently accepted but hidden from `--help`;
a prefixed option the engine does not re-expose is rejected rather than silently
ignored.

### Precedence

A shared global value is injected into a consolidated service flag **only when
the service's native env var did not set that flag** during its own CLI parse.
Consolidated flags are not re-exposed under service prefixes, so prefixed flags
such as `--storage-hasura-graphql-admin-secret` do not exist. The native env var
is the only override channel for these flags; otherwise, the global fills the
gap.

For the admin secret, graphql can override the global with
`CONSTELLATION_ADMIN_SECRET`. Auth and storage both read
`HASURA_GRAPHQL_ADMIN_SECRET`, so setting it overrides both services together;
the current engine surface cannot override the admin secret for only one of
auth or storage.

> Note: each service's own `--port` / `--bind` / `--debug` flags are not
> re-exposed — the shared listener and shared logger govern instead. The engine
> also owns the shared HTTP server and profiling surface, so
> `--graphql-http-read-timeout`, `--graphql-http-write-timeout`,
> `--graphql-http-idle-timeout`, `--graphql-profile-address`, and
> `--storage-pprof-bind` are rejected at startup rather than accepted and
> ignored.

## Build and run

With Nix:

```sh
nix build .#engine
./result/bin/engine --help

# docker image
nix build .#engine-docker-image
```

From the module (needs the engine dev shell for `vips` + `GOEXPERIMENT=jsonv2`):

```sh
nix develop .#engine
go build ./services/engine
```
