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

## Changesets

If you've made changes to the packages, you must describe those changes so that they can be reflected in the next release.
We use [changesets](https://github.com/changesets/changesets) to support our versioning and release workflows. When you submit a pull request, a bot checks if some changesets are present, and if not, it directs you to add them.

The most comprehensive way to add a changeset is to run the following command in the repository root:

```sh
$ pnpm changeset
```

This will create a file in the `.changeset` directory. You can edit it to give more details about the change you just made.

You can take a look at the changeset documentation: [How to add a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).
