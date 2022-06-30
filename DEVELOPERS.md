# Developer guide

## Requirements
- [pnpm](https://pnpm.io/)
- Docker and docker-compose
## Getting things ready

First, clone this repository:

```sh
git clone https://github.com/nhost/hasura-auth
```

Then, create a `.env` file from the example:

```sh
cd hasura-auth
cp .env.example .env
```
## Develop


```sh
make dev
```

Hasura-auth is now running on `http://localhost:4000` and will restart on evey change. GraphQL-codegen is watching the Hasura GraphQL and will regenerate every change in the schema.

## Test


```sh
make test
```

You can also run Jest in watch mode:

```sh
make watch
```

## Build the Docker image

```sh
make build
# Equivalent command:
# docker build -t nhost/hasura-auth:local .
```
## Generate the OpenAPI specs

```sh
make docgen
```

## Commit changes

This repository is [commitizen-friendly](https://github.com/commitizen/cz-cli#making-your-repo-commitizen-friendly) and follows the [conventional-changelog conventions](https://github.com/conventional-changelog/conventional-changelog).
Commits are linted so we can automatically bump semantic versions and changelog.

It is then recommended to commit your changes with `git cz`, or else (if commitizen is not installed) to use the command `pnpm run cz`.

## Release a new version

Thanks to the wonderful [release-it](https://github.com/release-it/release-it), maintainers of this repository can release a new version calculated from conventional commits, with the following command:

```sh
# Print what would be the next version
pnpm run release:preview
pnpm run release
```

It will then tag the branch, push to GitHub, and trigger a GitHub relase. A GitHub action will then takeover to test, build and tag the docker image, and publish it to [Docker Hub](https://hub.docker.com/r/nhost/hasura-auth).
