# Developer guide

## Requirements

- We use [pnpm](https://pnpm.io/) as a package manager to fasten development and builds, and as a backbone to our monorepo. You have to make sure it is installed in your machine. There are [multiple ways to install it](https://pnpm.io/installation), but the easiest way is with `npm`:

```sh
npm install -g pnpm
```

- Our tests and examples are using the Nhost CLI to run the backend services locally. You can follow the instructions to install it in [our documentation](https://docs.nhost.io/get-started/cli-workflow/install-cli)

## Getting things ready

First, clone this repository:

```sh
git clone https://github.com/nhost/nhost
```

Then, install the dependencies with `pnpm`:

```sh
cd nhost
pnpm install
```

## Starting development from an example

Let's follow the instructions to start [react-apollo example](https://github.com/nhost/nhost/blob/main/examples/react-apollo/README.md).

## Running the documentation website locally

The easier way to contribute to our documentation is to move to the `docs` folder and follow the [instructions to start local development](https://github.com/nhost/nhost/blob/main/docs/README.md):

```sh
cd docs
# not necessary step if you've done this step already anywhere in the repository
pnpm install
pnpm start
```

## Testing

In order to run tests, the Nhost testing backend should run locally. You can start in from a separate terminal:

```sh
cd examples/testing-project
nhost -d
```

Once Nhost runs locally, you can run the tests with the following command run from the root folder of the repository:

```sh
pnpm test
```

## Changesets

If you made some changes in the packages, you will have to describe these changes so they will be taken into account in the next release.
We are using [changesets](https://github.com/changesets/changesets) to support our version/publish workflows. When submitting a pull request, a bot will check if some changesets are present, and if not, will guide you to add them.

The most comprehensive way to add a changeset is to run the following command from the root directory of the repository:

```sh
pnpm changeset
```

This will generate a file in the `.changeset` directory. You can edit it to give further details about the change you just made.
You can have a look at the changesets documentation on [how to add a changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)

## Commiting changes

You may notice `git commit` takes a few seconds to run. We set a commit hook that scan the changes in the code, automatically generates the documentation from the inline [TSDoc](https://tsdoc.org/) annotations, and add these generated documentation files to the commit. They will automatically update the [reference documentation](https://docs.nhost.io/reference).

<!-- ## Good practices
- lint
- prettier
- documentation -->
