<h1 align="center">Stripe GraphQL API</h1>
<h2 align="center">@nhost/stripe-graphql-js</h2>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/@nhost/stripe-graphql-js">
  <img alt="npm" src="https://img.shields.io/npm/dm/@nhost/stripe-graphql-js">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="license: MIT" />
  </a>
</p>

## Documentation

[https://docs.nhost.io/graphql/remote-schemas/stripe](https://docs.nhost.io/graphql/remote-schemas/stripe).

## Development

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Include the correct admin secret header for admin access

```js
{
  "x-hasura-admin-secret":"<secret value matching your NHOST_ADMIN_SECRET environment variable>"
}
```

The GraphQL Server will reload every time the code changes.

Open GraphiQL:

[http://0.0.0.0:4000/graphql](http://0.0.0.0:4000/graphql)
