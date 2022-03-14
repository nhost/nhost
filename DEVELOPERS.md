# Developer guide

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

You will also need to install the dependencies. We are using [pnpm](https://pnpm.io/) as a package manager.
## Start

Run Hasura, PostgreSQL and the mock email server MailHog:

```sh
docker-compose up -d
```

Start Hasura-auth:

```sh
pnpm run dev
```

Hasura-auth is now running on `http://localhost:4000` and will restart on evey change. GraphQL-codegen is watching the Hasura GraphQL and will regenerate every change in the schema.

Don't forget to stop the docker-compose stack once you're done:

```sh
docker-compose down
```

## Test

First, you have to make sure the docker-compose stack is running.

```sh
pnpm run test
```

You can also run Jest in watch mode in using `pnpm run test -- --watch`

## Build

### Build locally

```sh
pnpm run build
```

### Build the Docker image

```sh
pnpm run build:docker
# Equivalent command:
# docker build -t nhost/hasura-auth:local .
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
