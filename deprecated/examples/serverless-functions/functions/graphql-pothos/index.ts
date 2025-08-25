/*

- How to create a custom GraphQL server with GraphQL Pothos

Test:

curl http://localhost:1337/v1/functions/graphql-pothos\
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"query":"{\n    hello\n}","variables":{}}'

Docs:

https://pothos-graphql.dev/
*/

import { createServer } from '@graphql-yoga/node'
import SchemaBuilder from '@pothos/core'

const builder = new SchemaBuilder({})

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string({ required: false })
      },
      resolve: (parent, { name }) => `hello, ${name || 'World'}`
    })
  })
})

const server = createServer({
  schema: builder.toSchema()
})

export default server
