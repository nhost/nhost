# Nhost Functions Development Runtime

**Important**: Always load the root `CLAUDE.md` at the repository root for general monorepo conventions before working on this project.

## Overview

This is a local development runtime for Nhost serverless functions. It runs an Express server that auto-discovers JS/TS files in a mounted `functions/` directory, bundles them with esbuild, and maps them to HTTP routes with hot-reload. It is **not a production service** -- it is used by the Nhost CLI for local development simulation.

## Directory Structure

```
services/functions/
├── server.js          # Main Express server with hot-reload and esbuild bundling
├── local-wrapper.js   # Express app wrapper template for individual functions
├── start.sh           # Docker entrypoint -- detects project layout, installs deps, starts server
├── tsconfig.json      # Default TypeScript config copied to user projects if missing
├── package.json       # Server runtime dependencies
├── pnpm-lock.yaml     # Lock file for server dependencies
├── project.nix        # Nix build configuration (check, devShell, package, Docker images)
├── Makefile           # Standard monorepo Makefile with multi-variant Docker support
├── CHANGELOG.md       # Auto-generated changelog via git-cliff
└── example/           # Example project for local testing
    ├── docker-compose.yaml
    └── functions/     # Sample function files
```

## Key Concepts

- **server.js**: Discovers functions via glob, creates an esbuild context per function, watches for changes. Routes are derived from file paths (e.g., `hello.ts` -> `/hello`). Index files map to parent directories.
- **local-wrapper.js**: Template that wraps each user function in an Express mini-app with JSON/URL-encoded body parsing (6MB limit), raw body preservation, invocation ID tracking, and error handling.
- **start.sh**: Docker entrypoint that detects whether `package.json` is at `./functions/` or `./`, validates a lock file exists, copies default `tsconfig.json`, installs dependencies via `ni` (@antfu/ni), and starts the server.
- **Routing**: `functions/hello.ts` -> `/hello`, `functions/sub/index.ts` -> `/sub/`, `functions/_utils/` -> ignored.
- **Docker images**: Built with nix2container. Two variants: Node 22 (default) and Node 20. Images include Node.js, pnpm, git, python3, make, and g++ for native dependency compilation.

## Development

```sh
make develop             # Enter nix develop shell
make check               # Run biome linting via nix
make build               # Build the nix package (server files)
make build-docker-image  # Build Docker image (Node 22, default)
FUNCTIONS_NODE_VERSION=20 make build-docker-image  # Build Node 20 variant
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
