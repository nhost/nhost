<h1 align="center">Stripe GraphQL API</h1>
<h2 align="center">@nhost/stripe-graphql-js</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/stripe-graphql-js">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/stripe-graphql-js">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

Expose Stripe's API as a GraphQL endpoint. Deploy as an [Nhost Function](https://docs.nhost.io/products/functions/) and connect it as a [Hasura Remote Schema](https://docs.nhost.io/products/graphql/remote-schemas) to query Stripe customers, subscriptions, invoices, payment methods, and more alongside your existing data.

## Quick Start

```bash
pnpm add @nhost/stripe-graphql-js
```

Create a file at `functions/graphql/stripe.ts`:

```ts
import { createStripeGraphQLServer } from '@nhost/stripe-graphql-js';

const server = createStripeGraphQLServer();

export default server;
```

Then register it as a Remote Schema pointing to `{{NHOST_FUNCTIONS_URL}}/graphql/stripe`.

See the full setup guide in the [documentation](https://docs.nhost.io/products/graphql/guides/stripe).

## Documentation

[https://docs.nhost.io/products/graphql/guides/stripe](https://docs.nhost.io/products/graphql/guides/stripe)

## Development

Set the required environment variables:

```bash
export STRIPE_SECRET_KEY=sk_test_...
export NHOST_ADMIN_SECRET=your-admin-secret
```

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

The GraphQL server will reload every time the code changes.

Open GraphiQL: [http://localhost:4000/graphql](http://localhost:4000/graphql)

To make requests as an admin, include the following header in GraphiQL:

```json
{
  "x-hasura-admin-secret": "<value matching your NHOST_ADMIN_SECRET>"
}
```
