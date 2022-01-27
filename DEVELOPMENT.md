# Development

We use nix to ensure a common and consistent development environment. You are also free to manage the environment on your own but that may mean your environment isn't exactly the same as the one used in the CI.

## nix

Useful commands:

1. `nix develop` - Starts a shell with all of the requirements and tools installed
2. `make help` - Shows everything you can and may need to do:
```
❯ make help
help:                                  Show this help.
tests: dev-env-up check                Spin environment and run nix flake check
check:                                 Run nix flake check
build:                                 Build application and places the binary under ./result/bin
build-docker-image:                    Build docker container
dev-env-up: dev-env-down dev-env-build Starts development environment
dev-env-down:                          Stops development environment
dev-env-build: build-docker-image      Builds development environment
dev-jwt:                               return a jwt valid for development environment
dev-s3-access-key:                     return s3 access key for development environment
dev-s3-secret-key:                     restun s3 secret key for development environment
migrations-add:                        add a migration with NAME in the migrations folder
```

Most of the time you will simply care about `make tests` as that does everything for you.
