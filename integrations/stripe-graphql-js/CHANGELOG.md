# @nhost/stripe-graphql-js

## 0.0.5

### Patch Changes

- 3c70860a: Add description for all Stripe GraphQL Fields
  Thanks [@piromsurang](https://github.com/piromsurang) for the contribution

## 0.0.4

### Patch Changes

- c922de7b: feat/added async support for isAllowed prop for createStripeGraphQLServer

## 0.0.3

### Patch Changes

- 78404102: Added the possibility to decide if the GraphiQL editor should be active or not.

  Example where the GraphiQL editor is not active:

  ```js
  const server = createStripeGraphQLServer({
    graphiql: false
  })
  ```
