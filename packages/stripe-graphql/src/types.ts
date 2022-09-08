import type Stripe from 'stripe'

import type { CORSOptions, YogaInitialContext } from '@graphql-yoga/node'

export type StripeGraphQLContext = {
  allowedCustomerIds?: string[]
}

export type Context = YogaInitialContext & StripeGraphQLContext

export type CreateServerProps = {
  cors?: CORSOptions
  context: (params: YogaInitialContext) => Context
}

// removing Stripe.Customer from `customer` because we will never expand
// and fetch the full customer object
export type StripePaymentMethod = Stripe.PaymentMethod & {
  customer: string | null
}
