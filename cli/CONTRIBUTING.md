# Developer Guide

## Requirements

### With Nix (Recommended)

Run `nix develop \#cli` to get a complete development environment.

### Without Nix

Check `project.nix` (checkDeps, buildInputs, buildNativeInputs) for manual dependency installation.

Required tools:
- Go
- golangci-lint
- golines
- gqlgenc
- oapi-codegen
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

# Lint Go code
golangci-lint run ./...

# Run tests
go test -v ./...
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

### Multi-Platform Builds

Build for multiple platforms (Darwin/Linux, ARM64/AMD64):
```bash
make build-multiplatform
```

This produces binaries for:
- darwin/arm64
- darwin/amd64
- linux/arm64
- linux/amd64

> **Note:** Works with and without Nix. Without Nix, a Docker container is used as the build environment, which may be slower.
