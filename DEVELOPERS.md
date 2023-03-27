# Developer guide

## Requirements

- This repository works with **Node 16**

- We use [pnpm](https://pnpm.io/) as a package manager to speed up development and builds, and as a basis for our monorepo. You need to make sure it's installed on your machine. There are [several ways to install it](https://pnpm.io/installation), but the easiest way is with `npm`:

```sh
$ npm install -g pnpm
```

- Our tests and examples use the Nhost CLI, to run the backend services locally. You can follow the installation instructions in [our documentation](https://docs.nhost.io/get-started/cli-workflow/install-cli).

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

Although package references are correctly updated on the fly for TypeScript, example projects won't
see the changes because they are depending on the build output. To fix this, you can run packages
in development mode.

Running packages in development mode is as simple as:

```sh
$ pnpm dev
```

Our packages are linked together using [PNPM's workspace](https://pnpm.io/workspaces) feature. Vite automatically detects changes in the dependencies and rebuilds everything, so that the changes are immediately reflected in the other packages.

### Use examples

Examples are a great way to test your changes in practice. Make sure you've `pnpm dev` running in your terminal and then run an example.

Let's follow the instructions to run [react-apollo example](https://github.com/nhost/nhost/blob/main/examples/react-apollo/README.md).

## Run the documentation website locally

The easier way to contribute to our documentation is to go to the `docs` folder and follow the [instructions to start local development](https://github.com/nhost/nhost/blob/main/docs/README.md):

```sh
$ cd docs
# not necessary if you've already done this step somewhere in the repository
$ pnpm install
$ pnpm start
```

## Run test suites

### Unit tests

You can run the unit tests with the following command from the repository root:

```sh
$ pnpm test
```

### End-to-end tests

Each package that defines end-to-end tests embeds their own Nhost configuration, that will be automatically when running the tests. As a result, you must make sure you are not running the Nhost CLI before running the tests.

You can run the e2e tests with the following command from the repository root:

```sh
$ pnpm e2e
```

## Changesets

If you've made changes to the packages, you must describe those changes so that they can be reflected in the next release.
We use [changesets](https://github.com/changesets/changesets) to support our versioning and release workflows. When you submit a pull request, a bot checks if some changesets are present, and if not, it directs you to add them.

The most comprehensive way to add a changeset is to run the following command in the repository root:

```sh
$ pnpm changeset
```

This will create a file in the `.changeset` directory. You can edit it to give more details about the change you just made.

You can take a look at the changeset documentation: [How to add a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).

## Committing changes

You'll notice that `git commit` takes a few seconds to run. We set a commit hook that scans the changes in the code, automatically generates documentation from the inline [TSDoc](https://tsdoc.org/) annotations, and adds these generated documentation files to the commit. They automatically update the [reference documentation](https://docs.nhost.io/reference).


<!-- ## Good practices
- lint
- prettier
- documentation -->
