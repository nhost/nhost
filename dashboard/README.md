# Nhost Dashboard

This is the Nhost Dashboard, a web application that allows you to manage your Nhost projects.
To get started, you need to have an Nhost project. If you don't have one, you can [create a project here](https://app.nhost.io).

First, install the dependencies:

```bash
pnpm install
```

Then, build the packages that are used by the Nhost Dashboard:

```bash
pnpm -w build
```

Finally, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result in your browser.

## Environment

### Setup Environment Variables

Depending on the environment you wish to target you can configure environment variables in `.env.<target_environment>.local`.

- `.env.development`: This file is used if you run `nhost up`
- `.env.development.local`: This file is used if you run `pnpm dev`. It takes precedence over `.env.local` if available.
- `.env.production.local`: This file is used if you run `pnpm build`. It takes precedence over `.env.local` if available.
- `.env.local`: This file is used if you run either `pnpm dev` or `pnpm build`.

These files are added to `.gitignore`, so you don't need to worry about committing them. It's important that you make sure you change environment variables in `.env` files ending with `.local`.

### Enable Local Development

You can connect the Nhost Dashboard to your **locally running** Nhost backend in a few steps. Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli/local-development).

First, you need to run the following command to start your backend locally:

```bash
cd <your_nhost_project> && nhost up
```

You can connect the Nhost Dashboard to your locally running backend by setting the following environment variables in `.env.development.local`:

```bash
NEXT_PUBLIC_ENV=dev
NEXT_PUBLIC_NHOST_PLATFORM=false
NEXT_PUBLIC_NHOST_AUTH_URL=https://local.auth.local.nhost.run/v1
NEXT_PUBLIC_NHOST_FUNCTIONS_URL=https://local.functions.local.nhost.run/v1
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://local.graphql.local.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.local.nhost.run/v1
NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=https://local.hasura.local.nhost.run
NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=https://local.hasura.local.nhost.run/v1/migrations
NEXT_PUBLIC_NHOST_HASURA_API_URL=https://local.hasura.local.nhost.run
```

This will connect the Nhost Dashboard to your locally running Nhost backend.

### General Environment Variables

| Name                             | Description                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ENV`                | `dev`, `staging` or `prod`. This should be set to `dev` in most cases.                                                                                                                                               |
| `NEXT_PUBLIC_NHOST_ADMIN_SECRET` | Admin secret for Hasura. Default: `nhost-admin-secret`                                                                                                                                                               |
| `NEXT_PUBLIC_NHOST_PLATFORM`     | This should be set to `false` to connect the Nhost Dashboard to a locally running or a self-hosted Nhost backend. Setting this to `true` will connect the Nhost Dashboard to the cloud environment. Default: `false` |

### Environment Variables for Local Development and Self-Hosting

| Name                                          | Description                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_NHOST_AUTH_URL`                  | The URL of the Auth service. When working locally, point it to the Auth service started by the CLI. When self-hosting, point it to the self-hosted Auth service.                                       |
| `NEXT_PUBLIC_NHOST_FUNCTIONS_URL`             | The URL of the Functions service. When working locally, point it to the Functions service started by the CLI. When self-hosting, point it to the self-hosted Functions service.                        |
| `NEXT_PUBLIC_NHOST_GRAPHQL_URL`               | The URL of the GraphQL service. When working locally, point it to the GraphQL service started by the CLI. When self-hosting, point it to the self-hosted GraphQL service.                              |
| `NEXT_PUBLIC_NHOST_STORAGE_URL`               | The URL of the Storage service. When working locally, point it to the Storage service started by the CLI. When self-hosting, point it to the self-hosted Storage service.                              |
| `NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL`        | The URL of the Hasura Console. When working locally, point it to the Hasura Console started by the CLI. When self-hosting, point it to the self-hosted Hasura Console.                                 |
| `NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL` | The URL of Hasura's Migrations service. When working locally, point it to the Migrations service started by the CLI.                                                                                   |
| `NEXT_PUBLIC_NHOST_HASURA_API_URL`            | The URL of Hasura's Schema and Metadata API. When working locally, point it to the Schema and Metadata API started by the CLI. When self-hosting, point it to the self-hosted Schema and Metadata API. |

### Content Security Policy (CSP) Configuration

The dashboard supports build-time CSP configuration to enable self-hosted deployments on custom domains.

| Name         | Description                                                                                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_MODE`   | Controls CSP behavior. Options: `nhost` (default, uses Nhost Cloud CSP), `disabled` (no CSP headers), `custom` (use custom CSP via `CSP_HEADER`). For self-hosted deployments on custom domains, set to `disabled` or `custom`.          |
| `CSP_HEADER` | Custom Content Security Policy header value. Only used when `CSP_MODE=custom`. Should be a complete CSP string (e.g., `default-src 'self'; script-src 'self' 'unsafe-eval'; ...`).                                                       |

### Other Environment Variables

| Name                                    | Description                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_STRIPE_PK`                 | Stripe public key. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.             |
| `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL`    | URL of the GitHub application. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`. |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`       | Analytics key. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.                 |
| `NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET`     | URL of the Bragi websocket. This is only used if `NEXT_PUBLIC_NHOST_PLATFORM` is `true`.    |
| `NEXT_PUBLIC_MAINTENANCE_ACTIVE`        | Determines whether or not maintenance mode is active.                                       |
| `NEXT_PUBLIC_MAINTENANCE_END_DATE`      | Date when maintenance mode will end.                                                        |
| `NEXT_PUBLIC_MAINTENANCE_UNLOCK_SECRET` | Secret that can be used to bypass maintenance mode.                                         |

## Biome Linting Rules

This project uses [Biome](https://biomejs.dev/) for linting. The rules are configured in `biome.jsonc`.

| Name                          | Level | Description                                                                                           |
| ----------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `useLiteralKeys`              | off   | Disabled to allow computed property access where appropriate.                                         |
| `noBannedTypes`               | off   | Disabled to allow usage of types like `{}` and `object` where needed.                                 |
| `useOptionalChain`            | error | Enforces optional chain wherever possible. For example: `user?.name` instead of `user && user.name`.  |
| `noNonNullAssertion`          | off   | Disabled to allow non-null assertions (`!`) where appropriate.                                        |
| `useThrowOnlyError`           | error | Enforces throwing only `Error` objects.                                                               |
| `noUselessElse`               | error | Disallows unnecessary `else` blocks after `return` statements.                                        |
| `noParameterAssign`           | error | Disallows reassigning function parameters.                                                            |
| `useBlockStatements`          | error | Enforces curly braces for all control flow statements.                                                |
| `noExtraNonNullAssertion`     | off   | Disabled to allow extra non-null assertions where needed.                                             |
| `noConsole`                   | error | Disallows `console` usage except for `console.error`, `warn`, and `info`.                             |
| `noExplicitAny`               | error | Disallows explicit `any` type usage.                                                                  |
| `noInnerDeclarations`         | error | Disallows function or variable declarations in blocks.                                                |
| `noUnusedImports`             | error | Reports unused imports with auto-fix enabled.                                                         |
| `noUnusedVariables`           | off   | Disabled (handled by TypeScript compiler).                                                            |
| `noUnusedFunctionParameters`  | off   | Disabled (handled by TypeScript compiler).                                                            |
| `noImportCycles`              | error | Prevents circular dependency errors.                                                                  |
| `noShadow`                    | error | Disallows variable declarations that shadow variables declared in outer scopes.                       |
| `noAccumulatingSpread`        | off   | Remove this rule once we have time to refactor the code that causes the warning.                      |

### Unit Tests

Unit tests are written using [Vitest](https://vitest.dev/). To run the tests, run the following command:

```bash
pnpm test
```

### End-to-End Tests

Most of the end-to-end tests require access to an Nhost test user and a live project. You can register a user and create a test project on the [Nhost Dashboard](https://app.nhost.io/).

Next, you need to create a project. Create a `.env.test` file with the following variables:

```
NHOST_TEST_DASHBOARD_URL=<test_dashboard_url>
NHOST_TEST_USER_EMAIL=<test_user_email>
NHOST_TEST_USER_PASSWORD=<test_user_password>
NHOST_TEST_ORGANIZATION_NAME=<test_organization_name>
NHOST_TEST_ORGANIZATION_SLUG=<test_organization_slug>
NHOST_TEST_PERSONAL_ORG_SLUG=<test_personal_org_slug>
NHOST_TEST_PROJECT_NAME=<test_project_name>
NHOST_TEST_PROJECT_SUBDOMAIN=<test_project_subdomain>
NHOST_TEST_PROJECT_ADMIN_SECRET=<test_project_admin_secret>
```

**Required Variables**:

- `NHOST_TEST_DASHBOARD_URL`: The URL to run the tests against (e.g: http://localhost:3000 or https://staging.app.nhost.io)
- `NHOST_TEST_USER_EMAIL`: Email address of the test user that owns the test project
- `NHOST_TEST_USER_PASSWORD`: Password of the test user that owns the test project
- `NHOST_TEST_ORGANIZATION_NAME`: Name of the organization that contains the test project
- `NHOST_TEST_ORGANIZATION_SLUG`: Slug of the organization that contains the test project
- `NHOST_TEST_PERSONAL_ORG_SLUG`: Slug of the personal organization that contains the test project
- `NHOST_TEST_PROJECT_NAME`: Name of the test project
- `NHOST_TEST_PROJECT_SUBDOMAIN`: Subdomain of the test project
- `NHOST_TEST_PROJECT_REMOTE_SCHEMA_NAME`: Name of the remote schema for the test project
- `NHOST_TEST_PROJECT_ADMIN_SECRET`: Admin secret of the test project

Make sure to copy the organization and project information from the [Nhost Dashboard](https://app.nhost.io/).

End-to-end tests are written using [Playwright](https://playwright.dev/). To run the tests, run the following command:

```bash
pnpm e2e
```
