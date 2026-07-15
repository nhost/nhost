# nhost-engine — unified service binary

Status: **draft / for review** — captures the agreed direction before the
operator-facing (breaking) refactors land.

## Goal

One binary, `nhost-engine`, that can run any subset of Nhost's Go services
(`auth`, `storage`, `constellation`/graphql) in a **single process**, sharing
one HTTP listener, one logger, one version, one config surface, and one
lifecycle (signals + graceful shutdown).

## Decisions (locked)

> **Revision (post-review).** The original design used a `--`-separated
> multi-service grammar where each service was selected on the command line.
> Per CTO feedback the engine is meant to *replace* the individual binaries, so
> the grammar was simplified to a single `serve` command that runs everything
> out of the box, with global flags plus service-prefixed flags. The
> `--`-separated grammar and its `runner.Split` dispatch were removed. The
> sections below describe the current design.

1. **Command structure** — one `serve` command runs every service by default;
   `--disable-<service>` opts one out. There is no per-service selection token.

   ```
   nhost-engine serve [global flags] [--auth-* --storage-* --graphql-* ...]
   nhost-engine serve --disable-storage        # run auth + graphql only
   ```

   `serve` must work out of the box (`nhost-engine serve` with no flags), so the
   engine reads like the end-state we want operators to use.

2. **Config** — a split flag surface: **global flags** for the settings common
   to every service (listener, logging, shared secrets, database URLs, CORS),
   set once with bare env vars (`BIND`, `ADMIN_SECRET`, …); and **prefixed
   flags** for each service's remaining options (`--auth-*`/`AUTH_*`,
   `--storage-*`/`STORAGE_*`, `--graphql-*`/`GRAPHQL_*`). This is a **breaking
   change** to existing env-var names — the engine replaces the per-service
   binaries rather than running alongside them.

3. **Networking** — a single shared port with path-namespaced routing:

   | Service        | Prefix       | Example                         |
   |----------------|--------------|---------------------------------|
   | auth           | `/auth`      | `/auth/v1/signin`               |
   | storage        | `/storage`   | `/storage/v1/files`             |
   | constellation  | `/graphql`   | `/graphql/v1`, `/graphql/v1/metadata` |

4. **Location** — new `services/nhost-engine/` (main.go + project.nix + Makefile),
   shared runtime helpers in `internal/lib/serve/`.

## CLI grammar

`nhost-engine` is a root command with one `serve` subcommand; urfave/cli/v3
owns `--help`/`--version`. `serve`'s flag set is built at construction time as:

- the **global flags** (`serveFlags` → `globalFlags`), plus
- for each service, its native `CommandServe().Flags` re-exposed under the
  service prefix by `servicePrefixedFlags`.

At run time `serve`'s action, for each enabled service, translates the prefixed
flags the operator set back into that service's native argument list
(`servicePassthroughArgs`), runs the service's own `CommandServe()` against
those args (so its real flag types, defaults, env sources, and validation stay
authoritative), and constructs its `serve.Service`. `--disable-<service>` skips
a service entirely; if all three are disabled the engine errors.

**Prefixed-flag mechanism.** Rather than clone every concrete urfave flag type,
`classifyFlag` reduces each native flag to one of three shapes via the
`DocGeneration*` interfaces — slice (multi-value), bool (takes no value), or
scalar — and re-exposes it as a `StringSliceFlag`, `BoolFlag`, or `StringFlag`
named `--<service>-<flag>` with env `<SERVICE>_<FLAG>`. Requiredness is **not**
propagated to the engine flag, so a `--disable`d service never forces its
required flags onto the engine; the service's own CLI still enforces them when
it is actually built.

## Config mapping

### Global flags (bare env)

| Global flag / env                     | Fills these service flags                                                        |
|---------------------------------------|-----------------------------------------------------------------------------------|
| `--bind` `BIND`                       | the shared listener (each service's own `port`/`bind` is not re-exposed)          |
| `--debug` `DEBUG`                     | the shared logger (each service's `debug` is not re-exposed)                      |
| `--log-format-text` `LOG_FORMAT_TEXT` | the shared logger                                                                 |
| `--admin-secret` `ADMIN_SECRET`       | auth `hasura-admin-secret`, storage `hasura-graphql-admin-secret`, graphql `admin-secret` |
| `--jwt-secret` `JWT_SECRET`           | auth `hasura-graphql-jwt-secret`, graphql `jwt-secret`                             |
| `--database-url` `DATABASE_URL`       | auth `postgres`, graphql `metadata-database-url`                                   |
| `--migrations-database-url` `MIGRATIONS_DATABASE_URL` | auth `postgres-migrations`, storage `postgres-migrations-source`   |
| `--cors-allowed-origins` `CORS_ALLOWED_ORIGINS` | storage `cors-allow-origins`, graphql `cors-allowed-origins`             |
| `--http-{read,write,idle}-timeout`    | the shared server                                                                 |
| `--disable-{auth,storage,graphql}`    | opt a service out                                                                 |

These native flag names are recorded in each service's `skip` set in
`registry.go`, so they are **not** re-exposed as prefixed flags — the global is
the single way to set them. A global fills a service flag only when the service
did not set it itself (`cmd.IsSet` false), so an explicit prefixed value or the
service's own env var always wins (service-wins precedence).

### Prefixed flags

Every remaining service flag is re-exposed under its prefix
(`--auth-*`/`AUTH_*`, `--storage-*`/`STORAGE_*`, `--graphql-*`/`GRAPHQL_*`).
Low-level tuning flags are listed in each service's `hidden` set — still
accepted, but hidden from `--help` (currently storage's `pprof-bind`).

Inter-service URLs (storage `hasura-endpoint`, auth `graphql-url`) point at the
in-process constellation once co-hosted — a later phase; for now they remain
explicit prefixed flags.

## Router composition

Each service today builds its own `*gin.Engine` and wraps it in its own
`*http.Server`. To share one port:

1. Refactor each service's `serve` to expose a **handler builder** —
   `func(...) (http.Handler, error)` — and a separate **background runner**
   (constellation's controller loop, storage's image-transformer workers) that
   takes the shared `context.Context`.
2. The engine mounts each service handler under its prefix on one
   `http.ServeMux` (via `http.StripPrefix`, or gin route groups if a service
   needs the prefix visible to its validator — `oapi.NewRouter` already accepts
   an `apiPrefix`, so pass `/auth`, `/storage`, `/graphql`).
3. One `*http.Server` on `--port`, shared HTTP timeouts.

## Lifecycle

- `main` installs `signal.NotifyContext(SIGINT, SIGTERM)` → the shared ctx.
- Selected services' background runners start as goroutines under that ctx.
- Shared HTTP server + optional pprof server.
- On signal: cancel ctx, `server.Shutdown(timeout)`, wait for runners.

## Version / logging

- Single `var Version` (`-X main.Version=…`), logged once at startup.
- `internal/lib/serve` exposes the shared `NewLogger` + `LogFlags`/`isSecret`
  helpers; each service's `serve` calls them directly (the earlier per-service
  `getLogger`/`logFlags` wrappers were redundant and removed).

## Phased implementation

1. **Extract shared runtime** — `internal/lib/serve` (logger, flag logging,
   secret redaction, version banner). Re-point storage + constellation at it.
   *Non-breaking, mechanical.* ✅ **DONE** — logger construction and flag
   logging are called directly (`serveutil.NewLogger`/`LogFlags`); the earlier
   per-service `getLogger`/`logFlags` wrappers were removed as redundant.
2. **Scaffold `services/nhost-engine/`** — main.go + `internal/runner` (the
   concurrent, signal-aware supervisor), reusing each service's existing
   `CommandServe()`. project.nix (reuses `storagef.vips`, GOEXPERIMENT=jsonv2) +
   Makefile + flake wiring (`nhost-engine` package/check/devShell/docker-image).
   ✅ **DONE**. The supervisor recovers a panicking service into a joined error
   (`runner.ErrServicePanic`) so one crash no longer takes the process down
   without a graceful sibling shutdown.
3. **Handler/runtime split** — refactor each service `serve` into
   handler-builder + background-runner, keep the old `serve` as a thin wrapper.
   ✅ **DONE** — each service exposes `NewService(ctx, cmd, logger) (*serve.Service,
   error)` (Handler + Background + Close); standalone `serve` builds it and runs a
   per-service `runServer`. Behavior preserved.
4. **Shared router + port** — mount services under prefixes on one server.
   ✅ **DONE** — `serve` composes every enabled service behind one shared
   listener (`--bind`/`BIND`, default `:8080`), mounting each under `/auth`,
   `/storage`, `/graphql` via `http.StripPrefix` so each service keeps serving
   its own native paths (auth's api-prefix, storage's `/v1`, constellation's
   `/v1/*`). One shared logger (`--debug`/`--log-format-text`); a root
   `/healthz`. Each service's background loop and the shared HTTP server run as
   supervised units; any exit tears down the rest and every service's `Close`
   runs on shutdown. pprof endpoints are not yet exposed on the shared port.
5. **Global + prefixed config** — split the flag surface into shared globals and
   service-prefixed passthrough. *Breaking.* ✅ **DONE** — globals: `--bind`,
   `--debug`, `--log-format-text`, `--http-{read,write,idle}-timeout`,
   `--disable-{auth,storage,graphql}`, and the injected cross-cutting values
   `--admin-secret`, `--jwt-secret`, `--database-url`,
   `--migrations-database-url`, `--cors-allowed-origins`, all with bare env
   vars. Every other service flag is re-exposed prefixed (`--auth-*`, etc.).
   **Mechanism (override):** each service still parses its own flags; the engine
   injects a global value onto a service flag only when the service did not set
   it itself (`cmd.IsSet` false), so an explicit prefixed flag/env always wins
   (service-wins precedence). Not yet unified: pprof bind, and inter-service
   URLs (storage `hasura-endpoint`, auth `graphql-url`) pending in-process
   co-hosting.
6. **Rewire the CLI (opt-in).** The `cli/` dev/docker-compose product can launch
   a single `nhost-engine` container instead of separate
   auth/storage/constellation containers. This is **opt-in** via
   `experimental.engine` in `nhost.toml`:

   ```toml
   [experimental.engine]
   version = "0.0.1"
   settings = { auth = {}, storage = {} }
   ```

   The engine always runs the constellation GraphQL engine — it is the core of
   the bundle and serves the `graphql` subdomain by default, no opt-in needed.
   The `auth` and `storage` services are optional and bundled by the presence of
   their `settings` key. The optional `settings.graphql` block only tunes
   constellation. The `auth`, `storage` and `graphql` values carry the same
   configuration as the standalone `auth`, `storage` and
   `experimental.constellation` blocks, minus `version` (the engine has a single
   `experimental.engine.version` that selects the `nhost/nhost-engine` image) and
   minus `resources`. `experimental.engine` is mutually exclusive with
   `experimental.constellation` (the engine already runs constellation as its
   GraphQL engine). When `experimental.engine` is unset the CLI keeps running the
   standalone auth/storage/constellation containers. ✅ **DONE.**
   Remaining work: publish the `nhost/nhost-engine` image and retire the
   per-service deployment artifacts once the engine covers them. ⏳
