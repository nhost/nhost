# Nhost Functions Development Runtime

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

## Overview

This is a local development runtime for Nhost serverless functions. It runs an Express server that auto-discovers JS/TS files in a mounted `functions/` directory, bundles them with esbuild, and maps them to HTTP routes with hot-reload. It is **not a production service** -- it is used by the Nhost CLI for local development simulation.

## Directory Structure

```
services/functions/
├── server.js              # Main Express server with hot-reload and esbuild bundling
├── local-wrapper.js       # Express app wrapper template for individual functions
├── start.sh               # Docker entrypoint -- detects project layout, installs deps, starts server
├── tsconfig.json          # Default TypeScript config copied to user projects if missing
├── package.json           # Server runtime dependencies (all under devDependencies)
├── pnpm-lock.yaml         # Lock file for server dependencies
├── project.nix            # Nix build configuration (check, devShell, package, Docker images)
├── Makefile               # Standard monorepo Makefile with multi-variant Docker support
├── jest.config.cjs        # Jest test configuration
├── CHANGELOG.md           # Auto-generated changelog via git-cliff
├── build/dev/docker/
│   └── docker-compose.yaml  # Dev environment: 4 containers (node20, node22, npm, yarn)
├── example-pnpm/          # Example project using pnpm
├── example-npm/           # Example project using npm
├── example-yarn/          # Example project using yarn
└── test/
    └── integration.test.js  # Integration tests against all 4 container variants
```

## Key Concepts

- **server.js**: Discovers functions via glob, creates an esbuild context per function, watches for changes. Routes are derived from file paths (e.g., `hello.ts` -> `/hello`). Index files map to parent directories. Builds are output to `.nhost-build/dist/`.
- **local-wrapper.js**: Template that wraps each user function in an Express mini-app with JSON/URL-encoded body parsing (6MB limit), raw body preservation, invocation ID tracking, and error handling. The placeholder `%FUNCTION_PATH%` is replaced at build time.
- **start.sh**: Docker entrypoint that detects whether `package.json` is at `./functions/` or `./`, validates a lock file exists, copies default `tsconfig.json`, installs dependencies via `nci` (@antfu/ni), and starts the server.
- **Routing**: `functions/hello.ts` -> `/hello`, `functions/sub/index.ts` -> `/sub/`, `functions/_utils/` -> ignored. Route lookup is flexible: tries exact match, then without trailing slash, then with trailing slash.
- **Docker images**: Built with nix2container. Two variants: Node 22 (default) and Node 20. Images include Node.js, pnpm, git, python3, make, and g++ for native dependency compilation.

## Development

```sh
make develop             # Enter nix develop shell
make check               # Run biome linting via nix
make build               # Build the nix package (server files)
make build-docker-image  # Build Docker image (Node 22, default)
NODE_VERSION=20 make build-docker-image  # Build Node 20 variant
```

## Testing

Integration tests require the dev environment running:

```sh
make dev-env-up          # Build images and start all 4 containers
make check
make dev-env-down        # Tear down
```

## Linting

Uses biome (root `biome.json`):

```sh
biome check .            # Check for issues
biome check --write .    # Auto-fix
```

## Commit Message Format

```
TYPE(functions): SUMMARY
```

Where `TYPE` is `feat`, `fix`, or `chore`.
