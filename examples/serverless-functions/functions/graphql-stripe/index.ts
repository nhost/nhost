/*

- How to create a Stripe GraphQL server.

Test:

curl http://localhost:1337/v1/functions/graphql-stripe \
  -X POST \
  -H 'x-hasura-admin-secret: nhost-admin-secret' \
  -H 'Content-Type: application/json' \
  -d '{"query":"query {\n  stripe {\n    customers {\n      data {\n        id\n        name\n      }\n    }\n  }\n}","variables":{}}'

Docs: 

https://github.com/nhost/nhost/tree/main/integrations/stripe-graphql-js
*/

import { createStripeGraphQLServer } from '@nhost/stripe-graphql-js'

export default createStripeGraphQLServer()
