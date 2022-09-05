import Stripe from 'stripe'

import SchemaBuilder from '@pothos/core'

import { Context } from './types'

const builder = new SchemaBuilder<{
  Objects: {
    StripeCustomer: Stripe.Customer
    StripeAddress: Stripe.Address
    StripePaymentMethod: Stripe.PaymentMethod
  }
  Context: Context
}>({})

builder.queryType()
// builder.mutationType()

export { builder }
