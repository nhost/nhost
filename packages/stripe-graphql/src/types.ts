import Stripe from 'stripe'

import type { CORSOptions, YogaInitialContext } from '@graphql-yoga/node'

export type StripeGraphQLContext = {
  stripe: Stripe
  allowedCustomerIds?: string[]
}

export type Context = YogaInitialContext & StripeGraphQLContext

export type CreateServerProps = {
  cors?: CORSOptions
  context: (params: YogaInitialContext) => Context
}
