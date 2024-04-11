# @nhost/stripe-graphql-js

## 1.2.0

### Minor Changes

- 768ca17: chore: update dependencies

## 1.1.1

### Patch Changes

- 7789469: chore: address linter errors and remove unnecessary imports

## 1.1.0

### Minor Changes

- 49a80c2: chore: update dependencies

## 1.0.7

### Patch Changes

- e5bab6a: chore: update dependencies

## 1.0.6

### Patch Changes

- 8d91f71: chore: update deps and enable pnpm audit

## 1.0.5

### Patch Changes

- 45759c4d4: fix(stripe-graphql-js): fix stripe GraphQL extension export issue in serverless functions

## 1.0.4

### Patch Changes

- 07a45fde0: chore(deps): bump `graphql` to `v16.7.1`

## 1.0.3

### Patch Changes

- da03bf39: chore(build): change build target to ES2019

## 1.0.2

### Patch Changes

- 01318860: fix(nhost-js): use correct URL for functions requests

## 1.0.1

### Patch Changes

- e146d32e: chore(deps): update dependency @types/react to v18.0.27

## 1.0.0

### Major Changes

- e6dad4d6: Added remote schemas

## 0.0.8

### Patch Changes

- 200e9f77: chore(deps): update dependency @types/react-dom to v18.0.10

## 0.0.7

### Patch Changes

- b21222b3: chore(deps): update dependency @types/node to v16

## 0.0.6

### Patch Changes

- 93db7182: feat(stripe-graphql-js): add charges, payment intents and connected accounts

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
