# Project Overview

Hybrid Go + TypeScript monorepo containing Nhost's open-source services, SDK, CLI, dashboard, and documentation. Uses Nix for Go builds and pnpm + Turbo for JS/TS workspaces.

**Important**: Each project may have its own `CLAUDE.md` with project-specific context. Always load the relevant project's `CLAUDE.md` when working on that project.

## Structure

### Go Services (`services/`)

- `services/auth` - JWT-based authentication service with OAuth2/OIDC support, email/SMS verification, WebAuthn. Uses OpenAPI (oapi-codegen), sqlc for DB queries, and gomock for testing
- `services/constellation` - GraphQL engine that turns relational databases (PostgreSQL, SQLite) into a role-based GraphQL API. Near-drop-in replacement for Hasura Community Edition: Hasura-compatible metadata, schema generation, queries/mutations/subscriptions, remote schemas, and cross-source remote relationships
- `services/functions` - Node.js development runtime for serverless functions with Express, esbuild bundling, and hot-reload. Local dev simulation only, not a production service
- `services/mcp` - MCP (Model Context Protocol) server exposing a Hasura GraphQL endpoint to AI assistants. OAuth2/OIDC auth with JWT forwarding to the upstream GraphQL endpoint
- `services/postgres` - PostgreSQL Docker image with the extensions and plugins used by Nhost projects (not a Go service; image config and tests only)
- `services/storage` - S3-compatible file storage with virus scanning (ClamAV), metadata management, and image transformation

### CLI (`cli/`)

- Go-based CLI for local development (`nhost dev`), project management, deployments, secrets, and MCP server

### Shared Libraries (`internal/lib/`)

- `internal/lib/oapi` - shared OpenAPI middleware and utilities
- `internal/lib/clidocs` - CLI documentation generation

### Dashboard (`dashboard/`)

- Next.js admin UI for managing Nhost projects. React 19, TypeScript, TanStack Query, Apollo Client, Tailwind CSS, Shadcn/Radix components

### JavaScript SDK (`packages/nhost-js/`)

- Client SDK providing auth, storage, GraphQL, and functions helpers. Builds to ESM, CJS, and UMD

### Documentation (`docs/`)

- Astro-based documentation site

### Examples (`examples/`)

- `examples/demos/` - feature demonstrations
- `examples/guides/` - learning guides (React Query, Apollo, CodeGen)
- `examples/quickstarts/` - quick setup examples (Next.js, React, React Native)
- `examples/tutorials/` - full tutorials (Next.js, Vue, React Native)
- `examples/docker-compose/` - self-hosting reference

### Build System (`build/`)

- `build/makefiles/general.makefile` - shared Makefile targets (help, develop, check, build, build-docker-image, dev-env-up/down)
- `build/makefiles/release.makefile` - release targets
- `build/configs/` - shared build configurations

### Tools (`tools/`)

- `tools/codegen` - code generation utilities
- `tools/ghactivity` - `gh` CLI extension (binary `gh-activity`, invoked as `gh activity ...`) that builds a markdown stand-up report of a user's GitHub PR/issue activity in an org over a time window
- `tools/govulncheck-wrapper` - wrapper around `govulncheck` for the monorepo's vulnerability scanning workflow

## Development Environment

- Go services use Nix dev shells. Enter with: `nix develop .\#<project-name>` (e.g., `nix develop .\#auth`)
- Each service has a `project.nix` and a `Makefile` that includes `build/makefiles/general.makefile`
- Common Makefile targets: `make help`, `make develop`, `make check`, `make build`, `make build-docker-image`, `make dev-env-up`, `make dev-env-down`
- JS/TS packages use pnpm 11.1.0 (not npm or yarn) with Turbo for orchestration
- Node >= 22 required
- Swift Nix support uses the pinned Swift.org toolchain in `nixops/overlays/swift.nix`; its XCTest path deliberately hides Swift Testing cross-import overlays because the official Linux 6.2.1 textual overlay does not rebuild reliably in Nix's non-FHS include layout.

## Code Standards

Authoritative design rules live in `.claude/docs/`. Load the one that matches the file you are touching before writing or reviewing code:

- **Go** — `.claude/docs/go-design-rules.md`. Covers placement, package invariants, local correctness, the mandatory `golines` / `golangci-lint --fix ./...` post-change checks, and the module-wide constraints (Go 1.26.0, single `go.mod` at root, generated-file globs, `exhaustruct` policy, `export_test.go` ban).
- **TypeScript / JavaScript** — `.claude/docs/javascript-design-rules.md`. Repo-wide rules plus separate sections for **Dashboard (React/Next.js)** and **SDK & Node**. Tooling: `pnpm` (never `npm`/`yarn`), Biome, Turbo, Node ≥ 22.

Per-project `CLAUDE.md`s layer project-specific invariants on top of these — read them too.

## CI/CD

- GitHub Actions workflows in `.github/workflows/`.
- Separate check and release workflows per project (e.g., `auth_checks.yaml`, `auth_wf_release.yaml`).
- Go services are built with Nix and packaged as Docker images.
- JS/TS packages are built with Turbo.
- Changelogs generated with `git-cliff`.

## Review Guidelines

PR review uses the agents in `.claude/agents/` (`go-developer`, `javascript-developer`, `generic-developer`) and the rules docs in `.claude/docs/`. The `/nhost_review` skill routes diff hunks to the right agent automatically. When reviewing manually, apply the design-rules document that matches the language of the change, and remember to update the project's `CLAUDE.md` if structure or standards change.
