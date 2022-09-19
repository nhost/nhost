import Stripe from 'stripe'

import { builder } from '../builder'
import { StripeInvoice, StripePaymentMethod, StripeSubscription } from '../types'
import { stripe } from '../utils'

import { StripePaymentMethodTypes } from './payment-methods'

builder.objectType('StripeCustomer', {
  description:
    'This object represents a customer of your business. It lets you create recurring charges and track payments that belong to the same customer.',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    }),
    balance: t.exposeInt('balance'),
    // TODO: cash_balance
    created: t.exposeInt('created'),
    currency: t.exposeString('currency', {
      nullable: true
    }),
    // TODO: default_source
    delinquent: t.exposeBoolean('delinquent', {
      nullable: true
    }),
    description: t.exposeString('description', {
      nullable: true
    }),
    // TODO: discount
    email: t.exposeString('email', {
      nullable: true
    }),
    // TODO: invoice_credit_balance
    invoicePrefix: t.exposeString('invoice_prefix', {
      nullable: true
    }),
    // TODO: invoice_settings
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    name: t.exposeString('name', {
      nullable: true
    }),
    nextInvoiceSequence: t.exposeInt('next_invoice_sequence', {
      nullable: true
    }),
    phone: t.exposeString('phone', {
      nullable: true
    }),
    preferredLocales: t.exposeStringList('preferred_locales', {
      nullable: true
    }),
    shipping: t.expose('shipping', {
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
    })
  })
})
