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

4. Start the CLI tool

```sh
pnpm start
```

The CLI tool will sign in using the service account credentials and create a
personal access token. This token will then be used to authenticate and make
requests to the Nhost backend as the service account without having to provide
the email address and password.

## Environment Variables

Credentials can be provided using environment variables. Create a `.env` file
in the root folder of the example. See `.env.example` for an example
configuration.

You can specify the following environment variables:

- `NHOST_SERVICE_ACCOUNT_PAT` - The personal access token of the service account. If provided, the email address and password will be ignored.
- `NHOST_SERVICE_ACCOUNT_EMAIL` - The email address of the service account.
- `NHOST_SERVICE_ACCOUNT_PASSWORD` - The password of the service account.

> If email and password are provided, the CLI tool will sign in first to create a personal access token for the account. This token will then be used to authenticate and make requests to the Nhost backend as the service account without having to provide the email address and password. Make sure to copy the token from the output and use it in the `NHOST_SERVICE_ACCOUNT_PAT` environment variable later.
