import { GraphQLJSONObject } from 'graphql-scalars'
import Stripe from 'stripe'

import SchemaBuilder from '@pothos/core'

import {
  Context,
  StripeCharge,
  StripeInvoice,
  StripePaymentIntent,
  StripePaymentMethod,
  StripeSubscription} from './types'

// TODO: Make sure we either use Type or Types (e.g. StripePaymentMethodTypes or StripePaymentMethodType ) everywhere

const builder = new SchemaBuilder<{
  Scalars: {
    JSON: {
      Output: unknown
      Input: JSON
    }
  }
  Objects: {
    Stripe: {}
    StripeMutations: {}

    // CUSTOMER
    StripeCustomers: Stripe.ApiList<Stripe.Customer>
    StripeCustomer: Stripe.Customer
    StripeCustomerShipping: Stripe.Customer.Shipping
    StripeCustomerTax: Stripe.Customer.Tax
    StripeCustomerTaxAutomaticTax: Stripe.Customer.Tax.AutomaticTax
    StripeCustomerTaxLocation: Stripe.Customer.Tax.Location

    // ADDRESS
    StripeAddress: Stripe.Address

    // PAYMENT METHOD
    StripePaymentMethods: Stripe.ApiList<StripePaymentMethod>
    StripePaymentMethod: StripePaymentMethod
    StripeCustomerListPaymentMethodsParamsType: Stripe.CustomerListPaymentMethodsParams.Type
    StripePaymentMethodBillingDetails: Stripe.PaymentMethod.BillingDetails
    StripePaymentMethodTypes: Stripe.PaymentMethod.Type

    // PAYMENT METHOD CARD
    StripePaymentMethodCard: Stripe.PaymentMethod.Card
    StripePaymentMethodCardChecks: Stripe.PaymentMethod.Card.Checks
    StripePaymentMethodCardNetworks: Stripe.PaymentMethod.Card.Networks
    StripePaymentMethodCardThreeDSecureUsage: Stripe.PaymentMethod.Card.ThreeDSecureUsage
    StripePaymentMethodCardWallet: Stripe.PaymentMethod.Card.Wallet
    StripePaymentMethodCardWalletMasterpass: Stripe.PaymentMethod.Card.Wallet.Masterpass
    StripePaymentMethodCardWalletType: Stripe.PaymentMethod.Card.Wallet.Type
    StripePaymentMethodCardWalletVisaMasterpass: Stripe.PaymentMethod.Card.Wallet.Masterpass
    StripePaymentMethodCardWalletVisaCheckout: Stripe.PaymentMethod.Card.Wallet.VisaCheckout

    // SUBSCRIPTION
    StripeSubscriptions: Stripe.ApiList<StripeSubscription>
    StripeSubscription: StripeSubscription
    StripeSubscriptionStatus: Stripe.Subscription.Status
    StripeSubscriptionItems: Stripe.ApiList<Stripe.SubscriptionItem>
    StripeSubscriptionItem: Stripe.SubscriptionItem
    StripeSubscriptionItemBillingThresholds: Stripe.SubscriptionItem.BillingThresholds
    StripeSubscriptionAutomaticTax: Stripe.Subscription.AutomaticTax
    StripeSubscriptionBillingThresholds: Stripe.Subscription.BillingThresholds
    StripeSubscriptionPauseCollection: Stripe.Subscription.PauseCollection

    // INVOICE
    StripeInvoice: StripeInvoice
    StripeInvoices: Stripe.ApiList<StripeInvoice>
    // StripeInvoceAccountTaxIds: Array<string | Stripe.TaxId | Stripe.DeletedTaxId> | null
    StripeInvoiceAutomaticTax: Stripe.Invoice.AutomaticTax
    StripeInvoiceCustomField: Stripe.Invoice.CustomField
    StripeInvoiceCustomerShipping: Stripe.Invoice.CustomerShipping
    StripeInvoiceCustomerTaxId: Stripe.Invoice.CustomerTaxId
    StripeInvoiceRenderingOptions: Stripe.Invoice.RenderingOptions
    StripeInvoiceStatusTransitions: Stripe.Invoice.StatusTransitions

    // INVOICE LINE ITEM
    StripeInvoiceLineItems: Stripe.ApiList<Stripe.InvoiceLineItem>
    StripeInvoiceLineItem: Stripe.InvoiceLineItem
    StripeInvoiceLineItemPeriod: Stripe.InvoiceLineItem.Period
    StripeInvoiceLineItemTaxAmount: Stripe.InvoiceLineItem.TaxAmount

    // PRICE
    StripePrice: Stripe.Price

    // PLAN
    StripePlan: Stripe.Plan
    StripePlanTransformUsage: Stripe.Plan.TransformUsage

    // PRODUCT
    StripeProduct: Stripe.Product

    // TAX RATES
    StripeTaxRate: Stripe.TaxRate

    // TEST CLOCK
    StripeTestClock: Stripe.TestHelpers.TestClock

    // BILLING PORTAL
    StripeBillingPortalSession: Stripe.BillingPortal.Session

    // PAYMENT INTENT
    StripePaymentIntent: StripePaymentIntent
    StripePaymentIntents: Stripe.ApiList<StripePaymentIntent>

    // CHARGES
    StripeCharge: StripeCharge
    StripeCharges: Stripe.ApiList<StripeCharge>

    // CONNECTED ACCOUNTS
    StripeConnectedAccount: Stripe.Account
    StripeConnectedAccounts: Stripe.ApiList<Stripe.Account>
  }
  Context: Context
}>({})

builder.queryType()
builder.mutationType()

builder.addScalarType('JSON', GraphQLJSONObject, {})

export { builder }
