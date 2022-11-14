# Nhost Dashboard

This is the Nhost Dashboard, a web application that allows you to manage your Nhost project.
To get started, you need to have an Nhost project. If you don't have one, you can [create a project here](https://app.nhost.io).

```bash
pnpm install
```

## Environment

### Setup Environment Variables

Depending on the environment you wish to target you can configure environment variables in `.env.<target_environment>.local`.

- `.env.development`: This file is used if you run `nhost dev`
- `.env.development.local`: This file is used if you run `pnpm dev`. It takes precedence over `.env.local` if available.
- `.env.production.local`: This file is used if you run `pnpm build`. It takes precedence over `.env.local` if available.
- `.env.local`: This file is used if you run either `pnpm dev` or `pnpm build`.

These files are added to `.gitignore`, so you don't need to worry about committing them. It's important that you make sure you change environment variables in `.env` files ending with `.local`.

### Enable Local Development

You can connect the Nhost Dashboard to your **locally running** Nhost backend in a few steps. Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli#installation).

First, you need to run the following command to start your backend locally:

```bash
cd <your_nhost_project> && nhost dev
```

Two environment variables are required to connect the Nhost Dashboard to your local backend:

- `NEXT_PUBLIC_NHOST_PLATFORM` should be set to `false`, because otherwise the Nhost Dashboard will try to connect to the Nhost platform.
- `NEXT_PUBLIC_NHOST_MIGRATIONS_URL` should be set to `http://localhost:9693` unless Hasura is configured to run on a different port. This is the URL of Hasura's migrations endpoint.

Example:

```
NEXT_PUBLIC_NHOST_PLATFORM=false
NEXT_PUBLIC_NHOST_MIGRATIONS_URL=http://localhost:9693
```

### Full list of environment variables

| Name                                 | Description                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_NHOST_PLATFORM`         | This should be set to `false` to connect the Nhost Dashboard to a locally running Nhost backend. |
| `NEXT_PUBLIC_NHOST_MIGRATIONS_URL`   | URL of Hasura's migrations endpoint. Used only if local development is enabled.                  |
| `NEXT_PUBLIC_NHOST_HASURA_URL`       | URL of the Hasura Console. Used only when `NEXT_PUBLIC_ENV` is `dev`.                            |
| `NEXT_PUBLIC_NHOST_BACKEND_URL`      | URL of the local backend. This is `http://localhost:1337` by default.                            |
| `NEXT_PUBLIC_ENV`                    | `dev`, `staging` or `prod`. Should be set to `dev` in most cases.                                |
| `NEXT_PUBLIC_STRIPE_PK`              | Stripe public key. Not necessary for local development.                                          |
| `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL` | URL of the GitHub application. Not necessary for local development.                              |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY`    | Analytics key. Not necessary for local development.                                              |
| `NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET`  | URL of the Bragi websocket. Not necessary for local development.                                 |

## ESLint Rules

| Name                                         | Description                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/react-in-jsx-scope`                   | Disabled because we don't need to import `React` anymore.                                                                                                    |
| `react/jsx-props-no-spreading`               | Disabled because we heavily rely on props spreading in our `@/ui/v2` components.                                                                             |
| `react/require-default-props`                | Disabled because we use TypeScript instead of PropTypes.                                                                                                     |
| `react-hooks/exhaustive-deps`                | Because we already had several rule violations when proper ESLint rules were introduced, we changed this rule to a warning.                                  |
| `import/extensions`                          | JS / TS files should be imported without file extensions.                                                                                                    |
| `react/jsx-filename-extension`               | JSX should only appear in `.jsx` and `.tsx` files.                                                                                                           |
| `react/jsx-no-bind`                          | Further investigation must be made on the performance impact of functions directly passed as props to components.                                            |
| `import/no-extraneous-dependencies`          | `devDependencies` should be excluded from the list of disallowed imports.                                                                                    |
| `curly`                                      | By default it only enforces curly braces for multi-line blocks, but it should be enforced for single-line blocks as well.                                    |
| `no-restricted-exports`                      | `export { default } from './module'` is used heavily in `@/ui/v2` which is a restricted export by default.                                                   |
| `@typescript-eslint/no-use-before-define`    | Order of type references should be ignored.                                                                                                                  |
| `no-undef`                                   | [Official TypeScript ESLint packages](https://github.com/typescript-eslint/typescript-eslint/issues/4671#issuecomment-1065948494) are turning off this rule. |
| `@typescript-eslint/no-shadow`               | TypeScript specific implementation of `no-shadow`.                                                                                                           |
| `@typescript-eslint/no-unused-vars`          | TypeScript specific implementation of `no-unused-vars`.                                                                                                      |
| `@typescript-eslint/prefer-optional-chain`   | Enforces optional chain wherever possible. For example: instead of `user && user.name` a much simpler `user?.name` will be enforced.                         |
| `@typescript-eslint/consistent-type-imports` | Enforces `import type { Type } from 'module'` syntax. It prevents false positive circular dependency errors.                                                 |
| `@typescript-eslint/naming-convention`       | Enforces a consistent naming convention.                                                                                                                     |
| `no-restricted-imports`                      | Enforces absolute imports and consistent import paths for components from `src/components/ui` folder.                                                        |
