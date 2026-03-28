# Project Overview

Hybrid Go + TypeScript monorepo containing Nhost's open-source services, SDK, CLI, dashboard, and documentation. Uses Nix for Go builds and pnpm + Turbo for JS/TS workspaces.

**Important**: Each project may have its own `CLAUDE.md` with project-specific context. Always load the relevant project's `CLAUDE.md` when working on that project.

## Structure

### Go Services (`services/`)

- `services/auth` - JWT-based authentication service with OAuth2/OIDC support, email/SMS verification, WebAuthn. Uses OpenAPI (oapi-codegen), sqlc for DB queries, and gomock for testing
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

## Development Environment

- Go services use Nix dev shells. Enter with: `nix develop .\#<project-name>` (e.g., `nix develop .\#auth`)
- Each service has a `project.nix` and a `Makefile` that includes `build/makefiles/general.makefile`
- Common Makefile targets: `make help`, `make develop`, `make check`, `make build`, `make build-docker-image`, `make dev-env-up`, `make dev-env-down`
- JS/TS packages use pnpm 10.26.0 (not npm or yarn) with Turbo for orchestration
- Node >= 22 required

## Code Standards

### Go

- Go 1.26.0, module path: `github.com/nhost/nhost`. Single `go.mod` at root — no per-project module files.
- Linting: `golangci-lint` with all linters enabled by default (config in `.golangci.yaml`). Run `golangci-lint run --fix`.
- Formatting: `golines -w  --base-formatter=gofumpt .`
- Do not modify generated files: `*_gen.go`, `*.gen.go`, `generated.go`, `models_gen.go`, `client_gen.go`, `schema.resolvers.go`.
- Always handle errors — never ignore them with `_`.
- Run `go generate ./...` if changes affect code generation.
- **Avoid `//nolint:exhaustruct`**. Prefer initializing all struct fields at construction time. Only use the nolint directive for external types you don't control (e.g., `http.Client`, K8s API types).
- In general, avoid nolint directives — only use them to suppress false positives or when fixing the linter error causes more harm than good.

### TypeScript / JavaScript

- **pnpm** is the package manager. Never use npm or yarn.
- **Biome** for linting and formatting (config in root `biome.json` and `dashboard/biome.json`). Single quotes, space indentation, import sorting.
- **Turbo** for monorepo task orchestration (config in `turbo.json`).
- Use absolute imports with `@/` alias in the dashboard (no relative imports).
- See `dashboard/CLAUDE.md` for detailed React/Next.js conventions.

## CI/CD

- GitHub Actions workflows in `.github/workflows/`.
- Separate check and release workflows per project (e.g., `auth_checks.yaml`, `auth_wf_release.yaml`).
- Go services are built with Nix and packaged as Docker images.
- JS/TS packages are built with Turbo.
- Changelogs generated with `git-cliff`.

## Review Guidelines

When reviewing PRs:
- Check for proper error handling and propagation.
- Ensure new code follows existing patterns in the project being modified.
- Watch for security issues: SQL injection, command injection, credential leaks.
- Verify that generated files are not manually edited.
- Check that new dependencies are justified.
- Ensure tests are included for new functionality.
- Ensure that CLAUDE.md is updated if project structure or standards change.
