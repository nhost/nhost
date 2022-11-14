# Serverless Functions Examples

Here are examples of Serverless Functions with Nhost.

Docs: [https://docs.nhost.io/platform/serverless-functions](https://docs.nhost.io/platform/serverless-functions)

## Examples

- [functions/cors](./functions/cors/index.ts) - How to enable CORS for browsers.
- [functions/env-vars](./functions/env-vars/index.ts) - How to use environment variables.
- [functions/graphql-pothos](./functions/graphql-pothos/index.ts) - How to create a custom GraphQL server with GraphQL Pothos.
- [functions/graphql-stripe](./functions/graphql-stripe/index.ts) - How to create a Stripe GraphQL server.
- [functions/graphql-yoga](./functions/graphql-yoga/index.ts) - How to create a custom GraphQL server with GraphQL Yoga.
- [functions/hello-world](./functions/hello-world/index.ts) - How to create a Serverless Function in TypeScript.
- [functions/helper-function](./functions/helper-function/index.ts) - How to import an internal function.
- [functions/javascript](./functions/javascript/index.ts) - How to create a Serverless Function in JavaScript.
- [functions/npm-packages](./functions/npm-packages/index.ts) - How to use npm packages.
- [functions/query-parameters](./functions/query-parameters/index.ts) - How to use query parameters.
- [functions/request-body](./functions/request-body/index.ts) - How to use the request body.
- [functions/routing](./functions/routing/index.ts) - How to manage routing.

See all examples in the [`functions/`](./functions/) folder.

## Get Started

1. Clone the repository

```
git clone https://github.com/nhost/nhost
cd nhost
```

2. Install and build dependencies

```
pnpm install
pnpm build
```

3. Go to the Serverless Functions example folder

```
cd examples/serverless-functions
```

4. Terminal 1: Start Nhost

> Make sure you have the [Nhost CLI installed](https://docs.nhost.io/platform/cli).

```
nhost up
```

5. Terminal 2: See logs for the Serverless Functions

```
nhost logs functions -f
```

Or see all logs:

```
nhost logs -f
```
