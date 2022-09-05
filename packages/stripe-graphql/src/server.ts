import { createServer } from '@graphql-yoga/node'

import { schema } from './schema'
import { CreateServerProps } from './types'

const createStripeGraphQLServer = ({ cors = false, context }: CreateServerProps) => {
  return createServer({
    cors,
    context,
    schema
  })
}

export { createStripeGraphQLServer, schema }
