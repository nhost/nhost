# Developer Guide

## Requirements

We use nix to manage the development environment, the build process and for running tests.

### With Nix (Recommended)

Run `nix develop \#storage` to get a complete development environment.

### Without Nix

Check `project.nix` (checkDeps, buildInputs, buildNativeInputs) for manual dependency installation. Alternatively, you can run `make nixops-container-env` in the root of the repository to enter a Docker container with nix and all dependencies pre-installed (note it is a large image).

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
  --ignore-file vacuum-ignore.yaml \
  controller/openapi.yaml

# Generate code
go generate ./...

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

### Docker Images

Build and import Docker images with skopeo:
```bash
make build-docker-image          # Storage service
```

If you run the command above inside the dockerized nixops-container-env and you get an error like:

```
FATA[0000] writing blob: io: read/write on closed pipe
```

then you need to run the following command outside of the container (needs skopeo installed on the host):

```bash
cd cli
make build-docker-image-import-bare
```

## Special Notes

### Image Processing

This service uses **libvips** for image processing, which requires:
- Native dependencies: clang, pkg-config
- System libraries: libjpeg, libpng, libwebp, openjpeg, libheif, pango, etc.

These are automatically configured in the Nix environment. For manual setup, ensure libvips and its dependencies are properly installed.

### ClamAV Integration

The storage service integrates with ClamAV for virus scanning. A separate ClamAV Docker image is built and used in development environments.
