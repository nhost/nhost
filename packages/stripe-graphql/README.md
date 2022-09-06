<h1 align="center">@nhost/stripe-graphql</h1>
<h2 align="center">Stripe GraphQL</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/stripe-graphql">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/stripe-graphql">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

Stripe GraphQL API with Hasura Remote schemas.

Connect data in your database with data from Stripe, via GraphQL.

```graphql
query {
  users {
    # User in your database
    id
    displayName
    userData {
      stripeCustomerId # Customer's Stripe Customer Id
      stripeCustomer {
        # Data directly from Stripe
        id
        name
        paymentMethods {
          id
          card {
            brand
            last4
          }
        }
      }
    }
  }
}
```

## Install

```bash
npm install @nhost/stripe-graphql
```

## Quick Start

### Serverless Function Setup

Inside a Nhost project, create a file in `functions/graphql/stripe.ts`:

```js
import Stripe from 'stripe'

import { createStripeGraphQLServer } from '@nhost/stripe-graphql'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-08-01'
})

const server = createStripeGraphQLServer({
  context: () => {
    return { stripe }
  }
})

export default server;
```

### Test

Test the Stripe GraphQL API:

[http://localhost:1337/v1/functions/graphql/stripe](http://localhost:1337/v1/functions/graphql/stripe)

### Remote Schema

Add the Stripe GraphQL API as a Remote Schema in Hasura.

URL: `{{NHOST_BACKEND_URL}}/v1/functions/graphql/stripe`

## Context

You need to provide a `context` function to the Stripe GraphQL Server.

You must return a `stripe` object and optional (recommended) `allowedStripeCustomerIds`.

Minimal example:

```js
const server = createStripeGraphQLServer({
  context: () => {
    return { stripe }
  }
})
```

Realistic example:

```js
const server = createStripeGraphQLServer({
  context: ({ request }) => {

  const authorizationHeader = request.headers.get('Authorization');
  const accessToken = authorizationHeader?.split(' ')[1];

  const userFromAccessToken = accessToken
    ? getUserFromAccessToken(accessToken)
    : undefined;

  if (!userFromAccessToken) {
    return { stripe };
  }

  // get user's stripe customer ids
  const { user } = await gqlSDK.getUser({
    id: userFromAccessToken.id,
  });

  if (!user) {
    return { stripe };
  }

  // get allowed stripe customer ids for this user
  const allowedStripeCustomerIds = user?.workspaceMembers
    .filter((wm) => {
      return typeof wm.workspace.stripeCustomerId === 'string';
    })
    .map((wm) => {
      return wm.workspace.stripeCustomerId as string;
    });

    return { stripe, allowedStripeCustomerIds }
  }
})
```

## Permissions

Either use `x-hasura-admin-secret` as a header or send `allowedStripeCustomerIds` as context to allow access.

## Development

Start dev server:

```
pnpm dev
```

Open GraphiQL:

[http://0.0.0.0:4000/graphql](http://0.0.0.0:4000/graphql)
