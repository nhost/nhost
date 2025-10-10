# Developer Guide

## Requirements

### With Nix (Recommended)

Run `nix develop \#auth` to get a complete development environment.

### Without Nix

Check `project.nix` (checkDeps, buildInputs, buildNativeInputs) for manual dependency installation.

Required tools:
- Go
- golangci-lint
- golines
- mockgen
- oapi-codegen
- sqlc
- postgresql (client)
- vacuum-go (OpenAPI linter)
- nhost-cli
- bun
- Docker (for dev environment)

## Development Workflow

### Running Tests

**With Nix:**
```bash
make dev-env-up
make check
```

**Without Nix:**
```bash
# Start development environment
make dev-env-up

# Lint OpenAPI spec
vacuum lint \
  -dqb -n info \
  --ruleset vacuum.yaml \
  docs/openapi.yaml

# Generate code
go generate ./...

# Lint Go code
golangci-lint run ./...

# Run tests
go test -v ./...

# Run e2e tests
bun install
bun test
```

### Formatting

Format code before committing:
```bash
golines -w --base-formatter=gofumpt .
```

## Building

### Local Build

Build the project (output in `./result`):
```bash
make build
```

### Docker Image

Build and import Docker image with skopeo:
```bash
make build-docker-image
```

> **Note:** Works with and without Nix. Without Nix, a Docker container is used as the build environment, which may be slower.
