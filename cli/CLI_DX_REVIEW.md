# Nhost CLI — DX Review & Improvement Ideas

> Scratch/working document. Maps the current CLI surface, calls out what already works well,
> and proposes DX improvements across the developer journey (onboarding → dev → deploy →
> collaborate → docs), plus dashboard-vs-CLI parity gaps and cross-cutting polish.
>
> Source of truth: `cli/` (Go, `urfave/cli/v3`). Command surface read from `cli/main.go` and
> `cli/cmd/**`. Dashboard parity inferred from `dashboard/src/pages/orgs/[orgSlug]/projects/**`.

---

## 1. Current command surface

Top-level commands registered in `cli/main.go`:

| Command | Purpose | Subcommands |
| --- | --- | --- |
| `init` | Initialize a new project (`--remote` to pull from a linked app) | — |
| `up` / `down` / `logs` | Start / stop / tail the local dev environment | `up cloud` |
| `dev` | Operate local dev environment (lower-level) | `compose`, `hasura` |
| `link` | Link a local app to a remote one | — |
| `list` | List remote orgs / workspaces / apps | — |
| `login` | Browser OAuth2 PKCE login (or PAT via `NHOST_PAT`) | — |
| `config` | Config-as-code operations | `default`, `example`, `apply`, `pull`, `show`, `validate`, `edit` |
| `secrets` | Manage cloud secrets | `create`, `delete`, `list`, `update` |
| `run` | Nhost Run (custom container services) | `config show/deploy/edit/edit-image/pull/validate/example`, `env` |
| `deployments` | Manage deployments | `list`, `logs`, `new` *(EXPERIMENTAL)* |
| `schema` | GraphQL schema utilities | `diff`, `dump` |
| `mcp` | Model Context Protocol server | `start`, `config`, `gen` |
| `docs` | Embedded documentation | `list`, `search`, `show` |
| `sw` | Software/self-management | `version`, `upgrade`, `uninstall` |
| `dockercredentials` | Docker credential helper | — |
| `configserver` | Config server (hidden/internal) | — |
| `gen-docs` | Generate CLI reference markdown | — |

---

## 2. What we already do well

These are genuine strengths worth preserving (and marketing):

- **One-command local stack.** `nhost up` brings up Postgres, Hasura/GraphQL, Auth, Storage,
  Functions, Dashboard, and Mailhog via docker-compose, then automatically applies migrations,
  metadata, and seeds (`cli/cmd/dev/up.go`). Very low friction.
- **TLS-by-default + branch-scoped volumes.** Local runs over TLS with a bundled cert, and
  docker volumes are namespaced per git branch (`--branch` defaults to current branch). This is
  a thoughtful git-based-workflow touch that avoids cross-branch data bleed.
- **Config-as-code with overlays + validation.** `config` and `run config` support
  `validate`, `example`, `edit`, `pull`, `apply`, and overlays. Infra is reviewable in git and
  diffable in PRs — strictly better than click-ops for reproducibility.
- **Modern, secure auth.** Browser-based OAuth2 **PKCE** login with a local callback server
  (`cli/clienv/wf_login.go`), plus PAT auth for CI. Refresh-token handling is built in.
- **First-class MCP server.** Built-in MCP (`nhost mcp`) with granular query/mutation
  permissions exposes GraphQL + docs to AI assistants — ahead of most competitors on AI DX.
- **Embedded, offline docs.** `nhost docs list/search/show` ships docs in the binary — works
  offline and feeds AI tooling. Underrated feature.
- **CI-friendly everywhere.** Nearly every flag has an `EnvVars(...)` source, shell completion
  is enabled (`EnableShellCompletion`), and `deployments new` reads `GITHUB_SHA`/`GITHUB_ACTOR`.
- **Broad install matrix.** brew, Nix (flake), npm/pnpm/yarn/bun, `npx`, and a curl installer
  with version pinning (`cli/README.md`). Teams can pin a version per-project.
- **Run services locally.** `--run-service` / `--run-service-volume` let you fold custom
  container services (with local bind mounts) into the dev stack — good for full-stack parity.
- **Graceful failure handling.** `up` traps SIGINT/SIGTERM and offers to tear down on error.

---

## 3. Improvement ideas by developer journey

### 3.1 Onboarding (first 10 minutes)

- **`nhost doctor` / preflight checks.** No command verifies Docker is installed/running,
  required ports (443, 5432, …) are free, or WSL2/Compose versions. Today failures surface as
  raw docker errors. A `doctor` command (or a preflight inside `up`) with actionable fixes would
  cut first-run support load dramatically.
- **Interactive `init` wizard + starter templates.** `init` scaffolds a fixed folder layout
  (`cli/cmd/project/init.go`) but doesn't offer framework starters. The dashboard has
  "one-click install" / quickstarts (Next.js, React, RN) — the CLI could scaffold the same
  front-end wiring (env vars, SDK client) so `init` produces a runnable full-stack repo.
- **`nhost whoami`.** There's `login` but no way to confirm *who* you're logged in as or which
  org/default project is active. Small command, big confidence boost.
- **Clearer "next step" breadcrumbs.** `init` ends with "run `nhost up`" (good). Extend this
  pattern consistently so every command nudges the logical next action.

### 3.2 Local development

- **`nhost status`.** No single command shows which services are running, their health, and
  their URLs after the fact. `up` prints URLs once (`printInfo`), but if you scroll past it the
  info is gone. A `status` command (and machine-readable `--json`) would help.
- **Disambiguate "reload".** `printInfo` tells users to "Run `nhost up` to reload" — overloading
  `up` as both start and reload is subtle. Consider a `nhost reload` alias or explicit messaging.
- **First-class migrations & seeds.** Creating migrations/seeds currently means dropping to the
  Hasura wrapper (`nhost dev hasura ...`). Promote common flows to `nhost migrations create`,
  `nhost seed`, etc., so users don't need Hasura-CLI knowledge.
- **Friendlier logs.** `logs` uses `SkipFlagParsing` and forwards raw args to docker compose
  (`cli/cmd/dev/logs.go`). Per-service shortcuts (`nhost logs auth -f`) and a documented filter
  syntax would beat "know the compose service names."
- **Functions ergonomics.** Functions run locally but there's no `nhost functions list/invoke`
  to introspect or test a function without curling the gateway.

### 3.3 Deploying

- **Human-friendly `nhost deploy`.** `deployments new` is marked EXPERIMENTAL and requires
  `--ref`, `--message`, `--user` (`cli/cmd/deployments/new.go`) — clearly built for CI, not a
  human at a terminal. A `nhost deploy` that infers ref/message/user from the local git state
  would make manual deploys first-class.
- **Deployment lifecycle gaps.** We have `list` and `logs` but no `rollback`, no "redeploy last",
  and no concise status summary. The `--follow` timeout message already points users to
  `deployments list` (nice) — build on that.
- **`nhost open`.** No command to open the dashboard, a deployment, or a service URL in the
  browser. Common in peer CLIs (Vercel/Netlify/Supabase) and cheap to add.

### 3.4 Collaboration

- **Config drift visibility.** `config pull` exists but there's no `config diff` to compare
  local config-as-code against what's deployed. Teams reviewing PRs would benefit from a clear
  "what changes on apply" preview (we already have `schema diff` as a precedent).
- **Token / access management.** PATs must be created in the dashboard; a `nhost tokens`
  (list/create/revoke) command would keep credential management in the terminal for CI setup.
- **Team / member visibility.** `list` shows orgs/workspaces/apps but there's no read access to
  members/roles. Even read-only `nhost org members` would help orient collaborators.

### 3.5 Documentation access

- **`nhost docs open`.** `docs show` renders in-terminal (great); add an `--open` to launch the
  canonical web page for richer content / sharing a link.
- **Examples in `--help`.** Most commands have a one-line `Usage` but no example invocations.
  Adding `UsageText`/examples (especially for multi-flag commands like `deployments new`,
  `run config deploy`) would make `--help` self-sufficient.

---

## 4. Dashboard ↔ CLI parity gaps

Capabilities present in the dashboard (`dashboard/src/pages/orgs/[orgSlug]/projects/**`) that
have **no direct CLI equivalent** today. Some are intentionally config-as-code (good!), but
discovery and read-access are the gaps.

| Dashboard capability | CLI today | Suggested CLI affordance |
| --- | --- | --- |
| **Users** (`/auth/users`) | none | `nhost auth users list/create/delete` (read at minimum) |
| **Storage browser** (`/storage`) | none | `nhost storage ls/cp/rm` against buckets |
| **Database browser / SQL** (`/database/browser`) | `schema diff/dump` (GraphQL only) | `nhost db sql`, `nhost db console` |
| **Backups** (`/backups`) | none | `nhost backups list/create/restore` |
| **Cloud logs** (`/logs`) | local logs only | `nhost logs --cloud` / `deployments logs` for services |
| **Metrics** (`/metrics`) | none | `nhost metrics` summary or `--open` |
| **Events** (cron / event triggers / one-offs) | none | manage via metadata, but surface a `nhost events` view |
| **AI** (assistants, auto-embeddings, file stores) | none | `nhost ai ...` (or document that it's config-driven) |
| **Remote schemas** (`/graphql/remote-schemas`) | none | manage via `config`/metadata; document the path |
| **DB ops**: reset password, version upgrade, PITR, allowed CIDRs | none | `nhost db ...` subcommands |
| **Settings**: auth/sign-in methods, SMTP, JWT, rate-limiting, custom domains, compute, roles & perms, OAuth2 provider | **config-as-code via `config apply`** ✅ | mostly covered — improve *discoverability* (e.g. `config edit --section auth`) |

> Note: the settings cluster is arguably *better* in the CLI (reviewable config-as-code). The
> real gap there is **discoverability** — users don't realize the dashboard toggles map to
> `nhost.toml` keys. A guided `config edit` and docs cross-links would close it.

---

## 5. Cross-cutting polish (quick wins)

- **Top-level error rendering.** `main.go` ends in `log.Fatal(err)`, so fatal errors print with
  a `log` timestamp/prefix — not a clean CLI look. Use a dedicated error renderer + meaningful
  exit codes (`cli.Exit`) consistently.
- **Structured output.** Plain `Println` output (e.g. `secrets list`, `list`) isn't scriptable.
  Add `--output json|table` (or a global `--json`) for piping into jq/CI.
- **Global log-level flag.** No visible global `--verbose`/`--quiet`/`--debug`. Helpful for
  debugging docker/compose issues during `up`.
- **Command aliases.** Most `Aliases` are empty `[]string{}`. Add muscle-memory aliases
  (`ls`→`list`, `rm`→`secrets delete`, `i`→`init`).
- **Copy/label fixes (small bugs):**
  - `cli/cmd/dev/up.go` — `--down-on-error` flag has `Usage: "Skip confirmation"` (mislabeled;
    describe the actual down-on-error behavior).
  - `cli/cmd/dev/up.go` — `--ca-certificates` usage typo: "Mounts and **everrides**" → "overrides".
- **Update nudges.** `CheckVersions` runs inside `up` (good); consider a lightweight,
  rate-limited "update available, run `nhost sw upgrade`" nudge on other commands too.
- **Grouping consistency.** `up`/`down`/`logs` are top-level while `dev` holds `compose`/`hasura`.
  Worth a deliberate decision on whether the local-env verbs all live under one group.

---

## 6. Suggested prioritization

**High impact / low effort**

- `nhost doctor` (preflight), `nhost whoami`, `nhost status`, `nhost open`
- Copy/label bug fixes; `--json` on `list`/`secrets list`; cleaner fatal-error rendering

**High impact / medium effort**

- Human-friendly `nhost deploy` (infer git state) + `rollback`
- `config diff` (local vs deployed)
- First-class `migrations`/`seed` commands wrapping Hasura

**Strategic / larger**

- Read-access CLI for users, storage, backups, cloud logs (dashboard parity)
- Starter-template `init` wizard matching dashboard one-click installs
- Discoverability layer mapping dashboard settings ↔ `nhost.toml` config-as-code
