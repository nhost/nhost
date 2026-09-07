# Development

The AI service uses the Nhost monorepo's [Nix](https://nixos.org) flake for a reproducible development environment. From `services/ai`, run `make develop`; from the repository root, run `nix develop .#ai`.

## Testing your changes

From `services/ai`:

1. Start the development environment with `make dev-env-up`. This builds the local `ai:0.0.0-dev` image and starts its dependencies.
2. Run the service checks with `make check`.
3. Stop the environment with `make dev-env-down` when finished.

Go dependencies belong in the repository root `go.mod` and `vendor/`. After changing dependencies, run `go mod tidy` and `go mod vendor` from the repository root.
