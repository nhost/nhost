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

You can connect the Nhost Dashboard to your **locally running** Nhost backend in a few steps. Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli#installation).

First, you need to run the following command to start your backend locally:

```bash
cd <your_nhost_project> && nhost up
```

You can connect the Nhost Dashboard to your locally running backend by setting the following environment variables in `.env.development.local`:

```bash
NEXT_PUBLIC_ENV=dev
NEXT_PUBLIC_NHOST_PLATFORM=false
NEXT_PUBLIC_NHOST_AUTH_URL=https://local.auth.nhost.run/v1
NEXT_PUBLIC_NHOST_FUNCTIONS_URL=https://local.functions.nhost.run/v1
NEXT_PUBLIC_NHOST_GRAPHQL_URL=https://local.graphql.nhost.run/v1
NEXT_PUBLIC_NHOST_STORAGE_URL=https://local.storage.nhost.run/v1
NEXT_PUBLIC_NHOST_HASURA_CONSOLE_URL=https://local.hasura.nhost.run
NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL=https://local.hasura.nhost.run/v1/migrations
NEXT_PUBLIC_NHOST_HASURA_API_URL=https://local.hasura.nhost.run
```

This will connect the Nhost Dashboard to your locally running Nhost backend.

### Storybook

Components are documented using [Storybook](https://storybook.js.org/). To run Storybook, run the following command:

```bash
pnpm storybook
```

By default, Storybook will run on port `6006`. You can change this by passing the `--port` flag:

```bash
pnpm storybook --port 6007
```

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

## ESLint Rules

| Name                                         | Description                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/react-in-jsx-scope`                   | Disabled because we don't need to import `React` anymore.                                                                                                    |
| `react/jsx-props-no-spreading`               | Disabled because we heavily rely on props spreading in our `@/components/ui/v2` components.                                                                  |
| `react/require-default-props`                | Disabled because we use TypeScript instead of PropTypes.                                                                                                     |
| `react-hooks/exhaustive-deps`                | Because we already had several rule violations when proper ESLint rules were introduced, we changed this rule to a warning.                                  |
| `import/extensions`                          | JS / TS files should be imported without file extensions.                                                                                                    |
| `react/jsx-filename-extension`               | JSX should only appear in `.jsx` and `.tsx` files.                                                                                                           |
| `react/jsx-no-bind`                          | Further investigation must be made on the performance impact of functions directly passed as props to components.                                            |
| `import/order`                               | Until we have a better auto-formatter, we disable this rule.                                                                                                 |
| `import/no-extraneous-dependencies`          | `devDependencies` should be excluded from the list of disallowed imports.                                                                                    |
| `curly`                                      | By default it only enforces curly braces for multi-line blocks, but it should be enforced for single-line blocks as well.                                    |
| `@typescript-eslint/no-use-before-define`    | Order of type references should be ignored.                                                                                                                  |
| `no-undef`                                   | [Official TypeScript ESLint packages](https://github.com/typescript-eslint/typescript-eslint/issues/4671#issuecomment-1065948494) are turning off this rule. |
| `@typescript-eslint/no-shadow`               | TypeScript specific implementation of `no-shadow`.                                                                                                           |
| `@typescript-eslint/no-unused-vars`          | TypeScript specific implementation of `no-unused-vars`.                                                                                                      |
| `@typescript-eslint/prefer-optional-chain`   | Enforces optional chain wherever possible. For example: instead of `user && user.name` a much simpler `user?.name` will be enforced.                         |
| `@typescript-eslint/consistent-type-imports` | Enforces `import type { Type } from 'module'` syntax. It prevents false positive circular dependency errors.                                                 |
| `@typescript-eslint/naming-convention`       | Enforces a consistent naming convention.                                                                                                                     |
| `no-restricted-imports`                      | Enforces absolute imports and consistent import paths for components from `src/components/ui` folder.                                                        |

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
NHOST_TEST_WORKSPACE_NAME=<test_workspace_name>
NHOST_TEST_PROJECT_NAME=<test_project_name>
NHOST_TEST_PROJECT_ADMIN_SECRET=<test_project_admin_secret>
```

**Required Variables**:

- `NHOST_TEST_DASHBOARD_URL`: The URL to run the tests against (e.g: http://localhost:3000 or https://staging.app.nhost.io)
- `NHOST_TEST_USER_EMAIL`: Email address of the test user that owns the test project
- `NHOST_TEST_USER_PASSWORD`: Password of the test user that owns the test project
- `NHOST_TEST_WORKSPACE_NAME`: Name of the workspace that contains the test project
- `NHOST_TEST_PROJECT_NAME`: Name of the test project
- `NHOST_TEST_PROJECT_ADMIN_SECRET`: Admin secret of the test project

Make sure to copy the workspace and project information from the [Nhost Dashboard](https://app.nhost.io/).

End-to-end tests are written using [Playwright](https://playwright.dev/). To run the tests, run the following command:

```bash
pnpm e2e
```
