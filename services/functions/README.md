# Nhost Functions Development Runtime

> **This is a local development approximation/simulation of the Nhost serverless functions runtime. It is not the production service and behavior may differ from production.**

The Nhost CLI uses this service to run serverless functions locally during development. It provides an Express-based HTTP server that auto-discovers JavaScript and TypeScript function files, bundles them with esbuild, and maps them to HTTP routes with hot-reload support.

## How It Works

- Discovers all `.js` and `.ts` files in the `functions/` directory (recursive)
- Maps file paths to HTTP routes (e.g., `functions/hello.ts` -> `/hello`, `functions/sub/index.ts` -> `/sub/`)
- Bundles each function with esbuild (minified, with source maps)
- Watches for file changes and automatically rebuilds affected functions
- Watches `package.json` and lock files for dependency changes and reinstalls automatically
- Files and directories starting with `_` are ignored (e.g., `_utils/`)

## Docker Image

The service ships as a Docker image (`nhost/functions`) with Node.js, pnpm, and build tools pre-installed. Users mount their project directory at `/opt/project`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PACKAGE_MANAGER` | `pnpm` | Package manager to use for dependency installation |
| `NHOST_PROJECT_PATH` | `/opt/project` | Path where the user's project is mounted |
| `SERVER_PATH` | `/opt/server` | Path to the server files (internal) |
| `NODE_OPTIONS` | `--enable-source-maps` | Node.js options for the server process |

### Endpoints

| Endpoint | Description |
|---|---|
| `GET /healthz` | Health check (returns 200) |
| `GET /_nhost_functions_metadata` | JSON list of all discovered functions |
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
make build-docker-image                        # Build Docker image (Node 22)
FUNCTIONS_NODE_VERSION=20 make build-docker-image  # Build Docker image (Node 20)
```

### Testing locally with the example

```sh
make build-docker-image
cd example
docker compose up
# Functions available at http://localhost:3000
```

## Release

Releases are managed through the monorepo CI pipeline. Creating a GitHub release with tag `functions@X.Y.Z` triggers the release workflow, which builds and pushes Docker images for both Node 20 and Node 22 to Docker Hub and ECR.

### Docker image variants

- `nhost/functions:X.Y.Z` - Node 22 (default)
- `nhost/functions-node20:X.Y.Z` - Node 20
