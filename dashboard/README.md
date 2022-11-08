# Nhost Dashboard

`yarn dev`
`yarn build`
`yarn predev` & `yarn prebuild` both generate gql hooks and types.

## Dependencies

- Git
- Docker
- [Nhost CLI](https://github.com/nhost/cli)

## Environment

Depending on the environment you wish to target you can configure environment variables in `.env.<target_environment>.local`.

- `env.development`: This file is used if you run `nhost dev`
- `env.development.local`: This file is used if you run `yarn dev`
- `.env.production.local`: This file is used if you run `yarn build`
- `.env.local`: This file is used if you run either `yarn dev` or `yarn build`

These files are added to `.gitignore`, so you don't need to worry about committing them. It's important that you make sure you change environment variables in `.env` files ending with `.local`.

Please see `.env.example` for a full list of environment variables used by the application.

## Enable Local Development

There are two environment environments to set to enable local development:

- `NEXT_PUBLIC_NHOST_PLATFORM` determines how the platform should work. For instance, a dashboard that's not connecting to Nhost's database doesn't need authentication or not applicable features (e.g: Deployments, Settings, etc.).
- `NEXT_PUBLIC_NHOST_MIGRATIONS_URL` is the URL of Hasura's migration service. This does not affect the local development directly, but it's required for the Database UI to work.

Example:

```
NEXT_PUBLIC_NHOST_PLATFORM=false
NEXT_PUBLIC_NHOST_MIGRATIONS_URL=http://localhost:9693
```

## Get Started

1. Clone repo
2. Install dependencies with `yarn`
3. Terminal 1: Start Nhost Backend: `nhost dev`
4. Terminal 2: Start web app: `yarn dev`
5. Terminal 3 (optional: Only for development): Start GraphQL Codegens: `yarn codegens:watch`

## Production

- Backend: https://nhost.run
- Web app: https://app.nhost.io

## Deployments

Code, migrations and metadata gets automatically deployed on push to the `main` branch.

## ESLint Rules

| Name                                         | Description                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/react-in-jsx-scope`                   | Disabled because we don't need to import `React` anymore.                                                                                                    |
| `react/jsx-props-no-spreading`               | Disabled because we heavily rely on props spreading in our `@/ui/v2` components.                                                                             |
| `react/require-default-props`                | Disabled because we use TypeScript instead of PropTypes.                                                                                                     |
| `import/extensions`                          | JS / TS files should be importaed without file extensions.                                                                                                   |
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
