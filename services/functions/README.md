# Nhost Functions Development Runtime

> **This is a local development approximation/simulation of the [Nhost Functions](https://docs.nhost.io/products/functions/) runtime. It is not the production service and behavior may differ slightly from production. We try to fix those differences when found so, please, raise an issue if you find any.**

The Nhost CLI uses this service to run serverless functions locally during development. It provides an Express-based HTTP server that auto-discovers JavaScript and TypeScript function files, bundles them with esbuild, and maps them to HTTP routes with hot-reload support.

## How It Works

- Discovers all `.js` and `.ts` files in the `functions/` directory (recursive)
- Maps file paths to HTTP routes (e.g., `functions/hello.ts` -> `/hello`, `functions/sub/index.ts` -> `/sub/`)
- Bundles each function with esbuild (minified, with source maps) into `.nhost-build/`
- Watches for file changes and automatically rebuilds affected functions
- Watches `package.json` and lock files for dependency changes and reinstalls automatically
- Files and directories starting with `_` are ignored (e.g., `_utils/`)
- Supports pnpm, npm, and yarn — detected via lock files and corepack

## Endpoints


| Endpoint | Description |
|---|---|
| `GET /healthz` | Health check (returns 200) |
| `GET /_nhost_functions_metadata` | JSON list of all discovered functions with route, runtime, and metadata |
| `* /<route>` | Proxied to the matching function handler |

## Development

### Prerequisites

Enter the nix dev shell:

```sh
make develop
```

### Commands

```sh
make help              # Show all available targets
make check             # Run linting via nix
make build             # Build the server package
make build-docker-image                    # Build Docker image (Node 22)
NODE_VERSION=20 make build-docker-image    # Build Docker image (Node 20)
```

### Testing locally with examples

There are three example projects (`example-pnpm/`, `example-npm/`, `example-yarn/`) that test different package manager configurations.

```sh
# Build both Docker image variants and run all examples
make dev-env-up
# Functions available at:
#   http://localhost:3001 (Node 20, pnpm)
#   http://localhost:3002 (Node 22, pnpm)
#   http://localhost:3003 (Node 22, npm)
#   http://localhost:3004 (Node 22, yarn)

# Or test a single example manually:
make build-docker-image
cd example-pnpm
docker compose up
# Functions available at http://localhost:3000
```

### Integration Tests

Integration tests require the dev environment to be running:

```sh
make dev-env-up        # Start all example containers
pnpm test:integration  # Run jest integration tests against all variants
make dev-env-down      # Tear down containers
```

Tests verify routing, metadata, 404 handling, utility imports (`_utils/`), npm dependency usage, and correct runtime detection across all four container variants.

## Release

Releases are managed through the monorepo CI pipeline. Creating a GitHub release with tag `functions@X.Y.Z` triggers the release workflow, which builds and pushes Docker images for both Node 20 and Node 22 to Docker Hub and ECR.

### Docker image variants

- `nhost/functions:X.Y.Z` - Node 22 (default)
- `nhost/functions-node20:X.Y.Z` - Node 20
