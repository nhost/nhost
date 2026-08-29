# CLAUDE.md

This file provides project-specific guidance for the AI service in the Nhost monorepo.

## Project Overview

Graphite is Nhost's AI service written in Go. It extends the Nhost stack with auto-embeddings (automatic vector embedding generation via OpenAI), AI assistants (OpenAI Assistants API with GraphQL integration), and multi-provider agents (Anthropic, OpenAI, Google Gemini with SSE streaming).

## Build & Development Commands

The service uses the monorepo Nix flake for reproducible builds. Run these commands from `services/ai` (or enter the shell from the repository root with `nix develop .#ai`).

```bash
make develop              # Enter the AI service dev shell
make check                # Lint + test + codegen verification through Nix
make build                # Build the binary through Nix (output in ./result/bin)
make build-docker-image   # Build the ai:VERSION Docker image
make dev-env-up           # Build AI and start postgres, hasura, auth, and storage
make dev-env-up-short     # Start dependencies without the AI service
make dev-env-down         # Stop the dev environment and remove volumes
make migrations-add MIGRATION_NAME=xxx  # Create new migration files
```

### Running Tests

```bash
go test ./...                    # Run all tests
go test -v ./path/to/package     # Run tests for a specific package
go test -run TestName ./...      # Run a specific test
```

Tests that need PostgreSQL require the dev environment running (`make dev-env-up`). The full CI check (`make check`) uses the root `.golangci.yaml`, runs tests, and verifies that code generation is up to date.

## Architecture

### Code Generation

Heavy use of code generation — always run `make check` after modifying schemas:

- **gqlgen** (`gqlgen.yml`): GraphQL schema (`schema/*.graphqls`) → resolvers in `graph/`, generated code in `graph/generated/`, models in `graph/model/models_gen.go`
- **gqlgenc** (`gqlgenc.yml`): Hasura GraphQL queries (`hasura/*.graphqls`) → client in `hasura/client_gen.go`, models in `hasura/models_gen.go`. It introspects the configured Hasura endpoint, so ensure the dev environment is running and Graphite migrations/metadata have been applied before regenerating.
- **oapi-codegen**: OpenAPI specs → generated clients in `openai/api/` and `storage/api/`
- **mockgen**: Mock interfaces for testing in package-local `mock/` directories

### Key Packages

- **`cmd/`** — CLI commands (serve, migrate, gen-jwt, healthcheck) using urfave/cli
- **`graph/`** — GraphQL resolvers and HTTP router (Gin). Resolver files follow naming: `m_*.go` (mutations), `q_*.go` (queries), `w_*.go` (webhooks)
- **`agents/`** — Multi-provider agent system with SSE streaming. Sub-packages: `provider/` (LLM abstraction), `tool/` (MCP, web search, web fetch)
- **`openai/`** — OpenAI API integration for assistants, threads, embeddings, files, vector stores
- **`autoai/`** — Auto-embeddings system that syncs database changes to vector embeddings
- **`hasura/`** — Hasura GraphQL client for database operations and metadata management
- **`migrations/`** — SQL migrations (`postgres/`) and Hasura setup (`hasura.go` for table tracking, event triggers)
- **`schema/`** — GraphQL schema definitions (`graphite.graphqls`)

### Request Flow

1. HTTP requests arrive at Gin router (`graph/router.go`)
2. GraphQL requests go through gqlgen resolvers with auth middleware (JWT validation, admin secret, webhook secret)
3. Agent SSE requests go to `POST /v1/agents/sessions/:sessionID/messages`
4. Hasura event triggers call webhook endpoints for auto-embeddings sync
5. Graphite registers itself as a Hasura remote schema on startup

### Database

PostgreSQL with `pgvector` and `http` extensions. Migrations in `migrations/postgres/` (sequential numbered SQL files). Tables live in the `graphite` schema.

## Core Principles

- **Always write tests** for new endpoints, tools, and significant logic changes
- **Follow existing patterns** — use neighboring implementations as examples before inventing new approaches
- **Security first** — validate inputs, never expose secrets or internal details in error messages, use parameterized queries
- **Database safety** — use transactions for multi-step operations, handle errors gracefully, always check for `pgx.ErrNoRows` specifically for not-found cases

## Code Standards

- Formatting: from the repository root, run `golines -w --base-formatter=gofumpt .`
- Do not modify generated files: `*_gen.go`, `generated.go`, `models_gen.go`, `client_gen.go`, `schema.resolvers.go`
- The repository has one root `go.mod` and root `vendor/`; never add service-local copies
- After dependency changes, run `go mod tidy` and `go mod vendor` from the repository root
- Always handle errors — never ignore them with `_`
- **Avoid `//nolint:exhaustruct`**. Prefer initializing all struct fields at construction time. Only use the nolint directive for external types you don't control (e.g., `http.Client`, `cli.Command`, generated Hasura types, SDK types). For internal structs, compute values before construction and pass them in the struct literal.
- Avoid nolint directives in general. Only use them to suppress false positives or when fixing the linter error causes more harm than good.
- Log warnings for user/client errors, errors for system/internal failures.

## Testing Patterns

- **Table-driven tests**: Use slice-of-structs test cases with descriptive names
- **Parallel execution**: Use `t.Parallel()` for all tests and subtests
- **Comparison**: Use `cmp.Diff` (from `github.com/google/go-cmp`) for comparing expected vs actual results
- **Mocking**: Use `gomock` (`go.uber.org/mock/gomock`) with `gomock.NewController(t)` for interface mocking
- **Coverage**: Test success cases, error cases, edge cases, and input validation
- **Test both paths**: Always test both success and error/failure paths

## Linting

golangci-lint with `default: all` (nearly all linters enabled). Key disabled linters: `depguard`, `gomoddirectives`, `musttag`, `nlreturn`, `tagliatelle`, `varnamelen`, `wsl`, `noinlineerr`, `funcorder`. Max function length: 65 lines.

## Development Workflow

1. **Design** — plan the feature, its inputs/outputs, and any database or schema changes
2. **Schema/Codegen** — update GraphQL schemas, OpenAPI specs, or SQL as needed, then run `make check` to regenerate
3. **Implement** — write the business logic following existing patterns
4. **Test** — write comprehensive tests covering success, error, and edge cases
5. **Format** — from the repository root, run `golines -w --base-formatter=gofumpt .`
6. **Lint** — from the repository root, run `golangci-lint run --fix ./...`
7. **Verify** — run `make check` to ensure everything passes

## Review Guidelines

When reviewing PRs:

- Check for proper error handling and propagation
- Ensure new code follows existing patterns in the package being modified
- Watch for security issues: SQL injection, command injection, credential leaks
- Verify that generated files are not manually edited
- Check that new dependencies are justified
- Ensure tests are included for new functionality
- Ensure that CLAUDE.md is updated if project structure or standards change

## Branch Naming

Prefix branches with: `bug/`, `feat/`, `chore/`, `docs/`
