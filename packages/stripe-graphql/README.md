<h1>⚠️ Work In Progress ⚠️</h1>

> This package being actively worked and is not stable.

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

Create a new [Serverless Function](https://docs.nhost.io/platform/serverless-functions) `functions/graphql/stripe.ts`:

```js
import { createStripeGraphQLServer } from '@nhost/stripe-graphql'

const server = createStripeGraphQLServer()

export default server
```

### Test

Test the Stripe GraphQL API:

[http://localhost:1337/v1/functions/graphql/stripe](http://localhost:1337/v1/functions/graphql/stripe)

### Remote Schema

Add the Stripe GraphQL API as a Remote Schema in Hasura.

URL: `{{NHOST_BACKEND_URL}}/v1/functions/graphql/stripe`

## Context

Minimal example without a context. Only request using the `x-hasura-admin-secret` header will work:

```js
const server = createStripeGraphQLServer()
```

You can provide a `context` function to the Stripe GraphQL Server.

You can return `allowedStripeCustomerIds`.

Realistic example:

```js
const server = createStripeGraphQLServer({
  context: ({ request }) => {

  // get the user's access token
  const authorizationHeader = request.headers.get('Authorization');
  const accessToken = authorizationHeader?.split(' ')[1];

  // verify the user's access token
  const userFromAccessToken = accessToken
    ? getUserFromAccessToken(accessToken)
    : undefined;

  if (!userFromAccessToken) {
    return { };
  }

  // get user information
  const { user } = await gqlSDK.getUser({
    id: userFromAccessToken.id,
  });

  if (!user) {
    return { };
  }

  // get user's allowed stripe customer ids
  const allowedStripeCustomerIds = user?.workspaceMembers
    .filter((wm) => {
      return typeof wm.workspace.stripeCustomerId === 'string';
    })
    .map((wm) => {
      return wm.workspace.stripeCustomerId as string;
    });

  return { allowedStripeCustomerIds }
})
```

## Permissions

Either use `x-hasura-admin-secret` (full access) as a header or send `allowedStripeCustomerIds` as context to allow access.

## Development

Start dev server:

```
pnpm dev
```

Open GraphiQL:

[http://0.0.0.0:4000/graphql](http://0.0.0.0:4000/graphql)
