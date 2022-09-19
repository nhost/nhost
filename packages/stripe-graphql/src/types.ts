import type Stripe from 'stripe'

import type { CORSOptions, YogaInitialContext } from '@graphql-yoga/node'

export type StripeGraphQLContext = {
  isAllowed: (stripeCustomerId: string, context: Context) => boolean
  userId?: string
  isAdmin: boolean
}

export type Context = YogaInitialContext & StripeGraphQLContext

export type CreateServerProps = {
  cors?: CORSOptions
  isAllowed?: (stripeCustomerId: string, context: Context) => boolean
}

// removing Stripe.Customer from `customer` because we will never expand
// and fetch the full customer object
export type StripePaymentMethod = Stripe.PaymentMethod & {
  customer: string | null
}

export type StripeSubscription = Stripe.Subscription & {
  customer: string
}

export type StripeInvoice = Stripe.Invoice & {
  id: string
  customer: string
  default_payment_method: StripePaymentMethod | null
}
