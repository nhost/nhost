import { createServer } from '@graphql-yoga/node'

import { schema } from './schema'
import { CreateServerProps } from './types'

// export type StripeGraphQLInitialContext = YogaInitialContext

const createStripeGraphQLServer = (props: CreateServerProps) => {
  const { cors, context } = props

  return createServer({
    cors: cors ? cors : false,
    context,
    schema
  })
}

export { createStripeGraphQLServer, schema }
