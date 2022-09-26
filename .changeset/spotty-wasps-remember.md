---
"@nhost/stripe-graphql-js": patch
---

Added the possibility to decide if the GraphiQL editor should be active or not.

Example where the GraphiQL editor is not active:

```js
const server = createStripeGraphQLServer({
  graphiql: false
})
```
