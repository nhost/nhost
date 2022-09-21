import { builder } from '../builder'

builder.objectType('StripeSubscriptionBillingThresholds', {
  description: '',
  fields: (t) => ({
    amountGte: t.exposeInt('amount_gte', {
      nullable: true
    }),
    resetBillingCycleAnchor: t.exposeBoolean('reset_billing_cycle_anchor', {
      nullable: true
    })
  })
})
