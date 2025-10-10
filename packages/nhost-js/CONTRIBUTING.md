# Developer Guide

## Requirements

We use nix to manage the development environment, the build process and for running tests.

### With Nix (Recommended)

Run `nix develop \#nhost-js` to get a complete development environment.

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
make dev-env-up

pnpm install

pnpm test
```

### Formatting

Format code before committing:
```bash
pnpm format
```

### Code Generation

Generate TypeScript clients from OpenAPI specs:

```bash
pnpm generate
```

This runs `./gen.sh` which generates code from:
- `services/auth/docs/openapi.yaml` - Auth service API
- `services/storage/controller/openapi.yaml` - Storage service API

## Building

### Build for Distribution

```bash
pnpm build
```

This produces:
- TypeScript type definitions
- ESM bundles (`.es.js`)
- CommonJS bundles (`.cjs.js`)
- UMD bundles for browser usage

Output is placed in the `dist/` directory.

## Development Notes

### Code Generation

The code generation script (`gen.sh`) reads OpenAPI specifications from the auth and storage services and generates TypeScript clients. Always regenerate after API changes.

### Dependencies

This package has minimal runtime dependencies to keep bundle size small. Only `tslib` is included as a production dependency.
