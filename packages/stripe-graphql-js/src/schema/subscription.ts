import { builder } from '../builder'
import { StripeInvoice, StripePaymentMethod } from '../types'
import { stripe } from '../utils'

builder.objectType('StripeSubscription', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    application: t.field({
      type: 'StripeConnectedAccount',
      nullable: true,
      resolve: async (subscription) => {
        const { application } = subscription
        if (!application) return null

        const connectedAccount = await stripe.accounts.retrieve(application as string)

        return connectedAccount
      }
    }),
    applicationFeePercent: t.exposeFloat('application_fee_percent', {
      nullable: true
    }),
    automaticTax: t.expose('automatic_tax', {
      type: 'StripeSubscriptionAutomaticTax'
    }),
    billingCycleAnchor: t.exposeInt('billing_cycle_anchor'),
    billingThresholds: t.expose('billing_thresholds', {
      type: 'StripeSubscriptionBillingThresholds',
      nullable: true
    }),
    cancelAt: t.exposeInt('cancel_at', {
      nullable: true
    }),
    cancelAtPeriodEnd: t.exposeBoolean('cancel_at_period_end'),
    canceledAt: t.exposeInt('canceled_at', {
      nullable: true
    }),
    collectionMethods: t.exposeString('collection_method'),
    created: t.exposeInt('created'),
    currency: t.exposeString('currency'),
    currentPeriodEnd: t.exposeInt('current_period_end'),
    currentPeriodStart: t.exposeInt('current_period_start'),
    customer: t.exposeString('customer'),
    daysUntilDue: t.exposeInt('days_until_due', {
      nullable: true
    }),
    defaultPaymentMethod: t.field({
      type: 'StripePaymentMethod',
      nullable: true,
      resolve: async (subscription) => {
        const { default_payment_method } = subscription
        if (!default_payment_method) {
          return null
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(default_payment_method as string)

        if (!paymentMethod) {
          return null
        }

        return paymentMethod as StripePaymentMethod
      }
    }),
    // todo: default source
    defaultTaxRates: t.expose('default_tax_rates', {
      type: ['StripeTaxRate'],
      nullable: true
    }),
    description: t.exposeString('description', {
      nullable: true
    }),
    // TODO: discount
    endedAt: t.exposeInt('ended_at', {
      nullable: true
    }),
    items: t.expose('items', {
      type: 'StripeSubscriptionItems'
    }),
    latestInvoice: t.field({
      type: 'StripeInvoice',
      nullable: true,
      resolve: async (subscription) => {
        const { latest_invoice } = subscription
        if (!latest_invoice) {
          return null
        }

        const invoice = await stripe.invoices.retrieve(latest_invoice as string)

        if (!invoice) {
          return null
        }

        return invoice as StripeInvoice
      }
    }),
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    nextPendingInvoiceItemInvoice: t.exposeInt('next_pending_invoice_item_invoice', {
      nullable: true
    }),
    pauseCollection: t.expose('pause_collection', {
      type: 'StripeSubscriptionPauseCollection',
      nullable: true
    }),
    // todo: payment settings
    // todo: pending_invoice_item_interval
    // todo: pending_setup_intent
    // todo: pending_update
    // todo: schedule
    startDate: t.exposeInt('start_date'),
    status: t.exposeString('status'),
    testClock: t.field({
      type: 'StripeTestClock',
      nullable: true,
      resolve: async (subscription) => {
        const { test_clock } = subscription

        if (!test_clock) {
          return null
        }

        const testClock = await stripe.testHelpers.testClocks.retrieve(test_clock as string)

        if (!testClock) {
          return null
        }

        return testClock
      }
    }),
    // todo: transfer data
    trialEnd: t.exposeInt('trial_end', {
      nullable: true
    }),
    trialStart: t.exposeInt('trial_start', {
      nullable: true
    })
  })
})
