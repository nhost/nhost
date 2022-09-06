import Stripe from 'stripe'

import SchemaBuilder from '@pothos/core'

import { Context } from './types'

const builder = new SchemaBuilder<{
  Objects: {
    Stripe: {
      customer: Stripe.Customer
    }
    StripeCustomer: Stripe.Customer
    StripeAddress: Stripe.Address
    StripePaymentMethods: Stripe.ApiList<Stripe.PaymentMethod>
    StripePaymentMethod: Stripe.PaymentMethod
    StripeCustomerListPaymentMethodsParamsType: Stripe.CustomerListPaymentMethodsParams.Type
    StripeSubscriptions: Stripe.ApiList<Stripe.Subscription>
    StripeSubscription: Stripe.Subscription
    StripeSubscriptionStatus: Stripe.Subscription.Status
  }
  Context: Context
}>({})

builder.queryType()
// builder.mutationType()

export { builder }
