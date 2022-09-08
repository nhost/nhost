import Stripe from 'stripe'

import SchemaBuilder from '@pothos/core'

import { Context, StripePaymentMethod } from './types'

// TODO: Make sure we either use Type or Types (e.g. StripePaymentMethodTypes or StripePaymentMethodType ) everywhere

const builder = new SchemaBuilder<{
  Scalars: {
    JSON: {
      Input: Date
      Output: Date
    }
  }
  Objects: {
    Stripe: {}
    StripeCustomer: Stripe.Customer
    StripeCustomerShipping: Stripe.Customer.Shipping
    StripeCustomerTax: Stripe.Customer.Tax
    StripeCustomerTaxAutomaticTax: Stripe.Customer.Tax.AutomaticTax
    StripeCustomerTaxLocation: Stripe.Customer.Tax.Location
    StripeAddress: Stripe.Address
    StripePaymentMethods: Stripe.ApiList<StripePaymentMethod>
    StripePaymentMethod: StripePaymentMethod
    StripeCustomerListPaymentMethodsParamsType: Stripe.CustomerListPaymentMethodsParams.Type
    StripePaymentMethodBillingDetails: Stripe.PaymentMethod.BillingDetails
    StripePaymentMethodCard: Stripe.PaymentMethod.Card
    StripePaymentMethodCardChecks: Stripe.PaymentMethod.Card.Checks
    StripePaymentMethodCardNetworks: Stripe.PaymentMethod.Card.Networks
    StripePaymentMethodCardThreeDSecureUsage: Stripe.PaymentMethod.Card.ThreeDSecureUsage
    StripePaymentMethodCardWallet: Stripe.PaymentMethod.Card.Wallet
    StripePaymentMethodCardWalletMasterpass: Stripe.PaymentMethod.Card.Wallet.Masterpass
    StripePaymentMethodCardWalletType: Stripe.PaymentMethod.Card.Wallet.Type
    StripePaymentMethodCardWalletVisaMasterpass: Stripe.PaymentMethod.Card.Wallet.Masterpass
    StripePaymentMethodCardWalletVisaCheckout: Stripe.PaymentMethod.Card.Wallet.VisaCheckout
    StripePaymentMethodTypes: Stripe.PaymentMethod.Type
    StripeSubscriptions: Stripe.ApiList<Stripe.Subscription>
    StripeSubscription: Stripe.Subscription
    StripeSubscriptionStatus: Stripe.Subscription.Status
  }
  Context: Context
}>({})

builder.queryType()
// builder.mutationType()

export { builder }
