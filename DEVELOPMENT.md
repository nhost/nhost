# Development

We use [nix](https://nixos.org) to ensure a common and consistent development environment. You are also free to manage the environment on your own but that may mean your environment isn't exactly the same as the one used in the CI. If you have nix installed everything you need to do to set the environment is to run `nix develop``

## C Dependencies

For performance reasons, hasura-storage relies on a C library called [libvips](https://www.libvips.org). This means that if you are developing locally you will need `libvips-dev` and the needed tooling to compile it (i.e. `gcc`, `pkg-config`). If you are a [nix](https://nixos.org) user you can use the provided nix flake to set the development environment for you. If you aren't a nix user, you can rely on the `Makefile` to build and run hasura-storage in a docker container with the proper environment set up.

## Testing your changes

To test your changes locally you can do the following:

1. Start the pre-requisite containers with `make dev-env-up-short`
2. Make your changes to the code
3. Build and deploy your container with `make dev-env-up-hasura`. Alternatively, if you have the development environment properly set up you can run `go run main.go serve` or `nix run . -- serve`
4. Run the tests with `make integration-tests`

When you are done you can stop your environment with `make dev-env-down`
