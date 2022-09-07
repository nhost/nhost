import Stripe from 'stripe'

import SchemaBuilder from '@pothos/core'

import { Context, StripePaymentMethod } from './types'

const builder = new SchemaBuilder<{
  Objects: {
    Stripe: {
      customer: Stripe.Customer
    }
    StripeCustomer: Stripe.Customer
    StripeAddress: Stripe.Address
    StripePaymentMethods: Stripe.ApiList<StripePaymentMethod>
    StripePaymentMethod: StripePaymentMethod
    StripeCustomerListPaymentMethodsParamsType: Stripe.CustomerListPaymentMethodsParams.Type
    StripePaymentMethodTypes: Stripe.PaymentMethod.Type
    StripeSubscriptions: Stripe.ApiList<Stripe.Subscription>
    StripeSubscription: Stripe.Subscription
    StripeSubscriptionStatus: Stripe.Subscription.Status
    // StripeMetadata: Stripe.Metadata
  }
  Context: Context
}>({})

builder.queryType()
// builder.mutationType()

export { builder }
