import Stripe from 'stripe'

import { builder } from '../builder'
import {
  StripeCharge,
  StripeInvoice,
  StripePaymentIntent,
  StripePaymentMethod,
  StripeSubscription} from '../types'
import { stripe } from '../utils'

import { StripePaymentMethodTypes } from './payment-methods'

builder.objectType('StripeCustomer', {
  description:
    'This object represents a customer of your business. It lets you create recurring charges and track payments that belong to the same customer.',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value. `
    }),
    address: t.expose('address', {
      description: `The customer's address.`,
      type: 'StripeAddress',
      nullable: true
    }),
    balance: t.exposeInt('balance', {
      description: `Current balance, if any, being stored on the customer. If negative, the customer has credit to apply to their next invoice. If positive, the customer has an amount owed that will be added to their next invoice. The balance does not refer to any unpaid invoices; it solely takes into account amounts that have yet to be successfully applied to any invoice. This balance is only taken into account as invoices are finalized.`
    }),
    // TODO: cash_balance
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.` 
    }),
    currency: t.exposeString('currency', {
      description: `Three-letter [ISO code for the currency](https://stripe.com/docs/currencies) the customer can be charged in for recurring billing purposes.`,
      nullable: true
    }),
    // TODO: default_source
    delinquent: t.exposeBoolean('delinquent', {
      description: `When the customer's latest invoice is billed by charging automatically, \`delinquent\` is \`true\` if the invoice's latest charge failed. When the customer's latest invoice is billed by sending an invoice, \`delinquent\` is \`true\` if the invoice isn't paid by its due date.\n\nIf an invoice is marked uncollectible by [dunning](https://stripe.com/docs/billing/automatic-collection), \`delinquent\` doesn't get reset to \`false\`.`,
      nullable: true
    }),
    description: t.exposeString('description', {
      description: `An arbitrary string attached to the object. Often useful for displaying to users.`,
      nullable: true
    }),
    // TODO: discount
    email: t.exposeString('email', {
      description: `The customer's email address.`,
      nullable: true
    }),
    // TODO: invoice_credit_balance
    invoicePrefix: t.exposeString('invoice_prefix', {
      description: `The prefix for the customer used to generate unique invoice numbers.`,
      nullable: true
    }),
    // TODO: invoice_settings
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON'
    }),
    name: t.exposeString('name', {
      description: `The customer's full name or business name.`,
      nullable: true
    }),
    nextInvoiceSequence: t.exposeInt('next_invoice_sequence', {
      description: `The suffix of the customer's next invoice number, e.g., 0001.`,
      nullable: true
    }),
    phone: t.exposeString('phone', {
      description: `The customer's phone number.`,
      nullable: true
    }),
    preferredLocales: t.exposeStringList('preferred_locales', {
      description: `The customer's preferred locales (languages), ordered by preference.`,
      nullable: true
    }),
    shipping: t.expose('shipping', {
      description: `Mailing and shipping address for the customer. Appears on invoices emailed to this customer.`,
      type: 'StripeCustomerShipping',
      nullable: true
    }),
    // TODO: sources
    tax: t.expose('tax', {
      type: 'StripeCustomerTax',
      nullable: true
    }),
    // TODO: tax_exempt
    // type TaxExempt = 'exempt' | 'none' | 'reverse';
    // TODO: tax_ids
    // tax_ids?: ApiList<Stripe.TaxId>;
    subscriptions: t.field({
      description: `The customer's current subscriptions, if any.`,
      type: 'StripeSubscriptions',
      nullable: false,
      resolve: async (customer) => {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id
        })
        return subscriptions as Stripe.Response<Stripe.ApiList<StripeSubscription>>
      }
    }),
    invoices: t.field({
      type: 'StripeInvoices',
      nullable: false,
      resolve: async (customer) => {
        const invoices = await stripe.invoices.list({
          customer: customer.id
        })
        return invoices as Stripe.Response<Stripe.ApiList<StripeInvoice>>
      }
    }),
    paymentIntents: t.field({
      type: 'StripePaymentIntents',
      nullable: false,
      resolve: async (customer) => {
        const paymentIntents = await stripe.paymentIntents.list({
          customer: customer.id
        })
        return paymentIntents as Stripe.Response<Stripe.ApiList<StripePaymentIntent>>
      }
    }),
    paymentMethods: t.field({
      type: 'StripePaymentMethods',
      args: {
        type: t.arg({
          type: StripePaymentMethodTypes,
          required: true,
          defaultValue: 'card'
        }),
        startingAfter: t.arg.string({
          required: false
        }),
        endingBefore: t.arg.string({
          required: false
        }),
        limit: t.arg.int({
          required: false
        })
      },
      nullable: false,
      resolve: async (customer, { type, startingAfter, endingBefore, limit }) => {
        const paymentMethods = await stripe.customers.listPaymentMethods(customer.id, {
          type,
          starting_after: startingAfter || undefined,
          ending_before: endingBefore || undefined,
          limit: limit || undefined
        })
        return paymentMethods as Stripe.Response<Stripe.ApiList<StripePaymentMethod>>
      }
    }),
    charges: t.field({
      type: 'StripeCharges',
      nullable: false,
      resolve: async (customer) => {
        const charges = await stripe.charges.list({
          customer: customer.id
        })
        return charges as Stripe.Response<Stripe.ApiList<StripeCharge>>
      }
    })
  })
})
