# Node.js CLI tool example with Personal Access Tokens

Todo app that shows how to use:

- [Nhost](https://nhost.io/)
- [Node.js](https://nodejs.org/en/)
- Personal Access Tokens

## Get Started

There is a migration script that creates a service account. The credentials of
this account are used to authenticate the CLI tool.

By default these credentials are used:

Email address: `cli@nhost.io`
Password: `Admin1234!`

1. Clone the repository

```sh
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install dependencies

```sh
pnpm install
```

3. Start the Nhost backend

```sh
nhost up
```

4. Run the help command to see the available commands

```sh
pnpm start --help
```

## Environment Variables

Credentials can be provided through the command line or by using environment
variables. Create a `.env` file in the root folder of the example. See `.env.example`
for an example configuration.

You can specify the following environment variables:

- `NHOST_ACCOUNT_PAT` - The personal access token of the service account. If provided, the email address and password will be ignored.
- `NHOST_ACCOUNT_EMAIL` - The email address of the service account.
- `NHOST_ACCOUNT_PASSWORD` - The password of the service account.

> If email and password are provided, the CLI tool will sign in first to create a personal access token for the account. This token will then be used to authenticate and make requests to the Nhost backend as the service account without having to provide the email address and password. Make sure to copy the token from the output and use it in the `NHOST_ACCOUNT_PAT` environment variable later.

## Commands

Environment variables should be placed in a `.env` file in the root folder of
the example. See `.env.example` for an example configuration.

### Use an existing personal access token to authenticate

```sh
pnpm start --token <personal-access-token>
```

or using environment variables:

```sh
NHOST_ACCOUNT_PAT=<personal-access-token> pnpm start
```

### Create a new personal access token

```sh
pnpm start --email cli@nhost.io --password Admin1234! --create-token --expires-at 2040-01-01 --token-name "CLI Token"
```

or using environment variables:

```sh
NHOST_ACCOUNT_EMAIL=cli@nhost.io NHOST_ACCOUNT_PASSWORD=Admin1234! pnpm start --create-token --expires-at 2040-01-01 --token-name "CLI Token"
```

### Create a new book

```sh
pnpm start --token <personal-access-token> --create-book <title>
```

or using environment variables:

```sh
NHOST_ACCOUNT_PAT=<personal-access-token> pnpm start --create-book <title>
```

### Delete a book

```sh
pnpm start --token <personal-access-token> --delete-book <id>
```

or using environment variables:

```sh
NHOST_ACCOUNT_PAT=<personal-access-token> pnpm start --delete-book <id>
```
