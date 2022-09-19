import { builder } from '../builder'

builder.objectType('StripeSubscription', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    // todo: application
    applicationFeePercent: t.exposeFloat('application_fee_percent', {
      nullable: true
    }),
    // todo: automaticTax
    billingCycleAnchor: t.exposeInt('billing_cycle_anchor'),
    // todo billing threasholds
    cancelAt: t.exposeInt('cancel_at', {
      nullable: true
    }),
    cancelAtPeriodEnd: t.exposeBoolean('cancel_at_period_end'),
    canceledAt: t.exposeInt('canceled_at', {
      nullable: true
    }),
    // todo: collection method
    created: t.exposeInt('created'),
    currency: t.exposeString('currency'),
    currentPeriodEnd: t.exposeInt('current_period_end'),
    currentPeriodStart: t.exposeInt('current_period_start'),
    customer: t.exposeString('customer'),
    daysUntilDue: t.exposeInt('days_until_due', {
      nullable: true
    }),
    // todo: default payment method
    // todo: default source
    // todo: default tax rates
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
    // todo: latest invoice
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    nextPendingInvoiceItemInvoice: t.exposeInt('next_pending_invoice_item_invoice', {
      nullable: true
    }),
    // todo: payse collection
    // payment settings
    // pending_invoice_item_interval
    // pending_setup_intent
    // pending_update
    // schedule
    startDate: t.exposeInt('start_date'),
    status: t.exposeString('status'),
    // todo: test clock
    // todo: transfer data
    trialEnd: t.exposeInt('trial_end', {
      nullable: true
    }),
    trialStart: t.exposeInt('trial_start', {
      nullable: true
    })
  })
})

// export const SubscriptionStatus = builder.enumType('StripeSubscriptionStatus', {
//   values: {
//     ACTIVE: { value: 'active' },
//     CANCELED: { value: 'canceled' },
//     INCOMPLETE: { value: 'incomplete' },
//     INCOMPLETE_EXPIRED: { value: 'incomplete_expired' },
//     PAST_DUE: { value: 'past_due' },
//     TRIALING: { value: 'trialing' },
//     UNPAID: { value: 'unpaid' }
//   } as const
// })
