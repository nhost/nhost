<h1 align="center">@nhost/stripe-graphql</h1>
<h2 align="center">Stripe GraphQL</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/stripe-graphql">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/stripe-graphql">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

Stripe GraphQL API for Hasura Remote schemas.

Connect data in your database with data from Stripe, via GraphQL.

```graphql
query {
  users {
    # User in your database
    id
    displayName
    userData {
      stripeCustomerId # Customer's Stripe Customer Id
      stripePaymentMethods {
        # Data directly from Stripe
        id
        card {
          brand
          last4
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

Inside a Nhost project, create a file in `functions/graphql/stripe.ts`:

```js
import Stripe from 'stripe'

import { createStripeGraphQLServer } from '@nhost/stipe-graphql'

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

Test the Stripe GraphQL API:

[http://localhost:1337/v1/functions/graphql/stripe](http://localhost:1337/v1/functions/graphql/stripe)

Add the Stripe GraphQL API as a remote schema in Hasura.

URL: `{{NHOST_BACKEND_URL}}/v1/functions/graphql/stripe`

## Documentation

TOOD
