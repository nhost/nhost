# Developer Guide

## Requirements

### Node.js v20 or later

### [pnpm](https://pnpm.io/) package manager

The easiest way to install `pnpm` if it's not installed on your machine yet is to use `npm`:

```sh
$ npm install -g pnpm
```

### [Nhost CLI](https://docs.nhost.io/platform/cli/local-development)

- The CLI is primarily used for running the E2E tests
- Please refer to the [installation guide](https://docs.nhost.io/platform/cli/local-development) if you have not installed it yet

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
