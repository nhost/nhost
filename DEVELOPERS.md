# Developer Guide

## Requirements

### Node.js v18

_⚠️ Node.js v16 is also supported for the time being but support will be dropped in the near future_.

### [pnpm](https://pnpm.io/) package manager

The easiest way to install `pnpm` if it's not installed on your machine yet is to use `npm`:

```sh
$ npm install -g pnpm
```

### [Nhost CLI](https://docs.nhost.io/cli)

- The CLI is primarily used for running the E2E tests
- Please refer to the [installation guide](https://docs.nhost.io/get-started/cli-workflow/install-cli) if you have not installed it yet

## File Structure

The repository is organized as a monorepo, with the following structure (only relevant folders are shown):

```
assets/            # Assets used in the README
config/            # Configuration files for the monorepo
dashboard/         # Dashboard
docs/              # Documentation website
examples/          # Example projects
packages/          # Core packages
integrations/      # These are packages that rely on the core packages
```

## Get started

### Installation

First, clone this repository:

```sh
git clone https://github.com/nhost/nhost
```

Then, install the dependencies with `pnpm`:

```sh
$ cd nhost
$ pnpm install
```

### Development

Although package references are correctly updated on the fly for TypeScript, example projects and the dashboard won't see the changes because they are depending on the build output. To fix this, you can run packages in development mode.

Running packages in development mode from the root folder is as simple as:

```sh
$ pnpm dev
```

Our packages are linked together using [PNPM's workspace](https://pnpm.io/workspaces) feature. Next.js and Vite automatically detect changes in the dependencies and rebuild everything, so the changes will be reflected in the examples and the dashboard.

**Note:** It's possible that Next.js or Vite throw an error when you run `pnpm dev`. Restarting the process should fix it.

### Use Examples

Examples are a great way to test your changes in practice. Make sure you've `pnpm dev` running in your terminal and then run an example.

Let's follow the instructions to run [react-apollo example](https://github.com/nhost/nhost/blob/main/examples/react-apollo/README.md).

## Edit Documentation

The easier way to contribute to our documentation is to go to the `docs` folder and follow the [instructions to start local development](https://github.com/nhost/nhost/blob/main/docs/README.md):

```sh
$ cd docs
# not necessary if you've already done this step somewhere in the repository
$ pnpm install
$ pnpm start
```

## Run Test Suites

### Unit Tests

You can run the unit tests with the following command from the repository root:

```sh
$ pnpm test
```

### E2E Tests

Each package that defines end-to-end tests embeds their own Nhost configuration, that will be automatically when running the tests. As a result, you must make sure you are not running the Nhost CLI before running the tests.

You can run the e2e tests with the following command from the repository root:

```sh
$ pnpm e2e
```

## Changesets

If you've made changes to the packages, you must describe those changes so that they can be reflected in the next release.
We use [changesets](https://github.com/changesets/changesets) to support our versioning and release workflows. When you submit a pull request, a bot checks if changesets are present, and if not, it asks you to add them.

To create a changeset, run the following command from the repository root:

```sh
$ pnpm changeset
```

This command will guide you through the process of creating a changeset. It will create a file in the `.changeset` directory.

You can take a look at the changeset documentation: [How to add a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).

### Selecting the Version

When you create a changeset, you will be asked to select the version of the package that you are bumping. The versioning scheme is as follows:

- **major**
  - For breaking changes (e.g: changing the function signature, etc.)
  - Should be avoided as much as possible as it will require users to update their code. Instead, consider supporting both the old and the new API simultaneously for a while.
  - For example: `v1.5.8` -> `v2.0.0`
- **minor**
  - For new features (e.g: adding a new page to the dashboard, etc.)
  - For example: `v1.5.8` -> `v1.6.0`
- **patch**
  - For bug fixes (e.g: fixing a typo, etc.)
  - For example: `v1.5.8` -> `v1.5.9`

### Writing Good Changesets

A concise summary that describes the changes should be added to each PR. This summary will be used as the changeset description.

The following structure is used for describing changes:

- **The type of the change**:

  - fix
  - feat
  - chore
  - docs

- **The scope of the change** (_broader scopes (e.g: dashboard, hasura-storage-js, etc.) are not recommended as GitHub Releases already contain which project is being bumped_):

  - projects
  - deployments
  - deps
  - etc.

- **A short summary of the changes that were made**

**Examples:**

- `fix(deployments): use correct timestamp for deployment details`
- `chore(deps): bump @types/react to v18.2.8`
- `feat(secrets): enable secrets`
- etc.

You can always take a look at examples of changesets in the [GitHub Releases section](https://github.com/nhost/nhost/releases).
