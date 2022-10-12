import { builder } from '../builder'

builder.objectType('StripeSubscriptionBillingThresholds', {
  description: '',
  fields: (t) => ({
    amountGte: t.exposeInt('amount_gte', {
      description: `Monetary threshold that triggers the subscription to create an invoice`,
      nullable: true
    }),
    resetBillingCycleAnchor: t.exposeBoolean('reset_billing_cycle_anchor', {
      description: `Indicates if the \`billing_cycle_anchor\` should be reset when a threshold is reached. If true, \`billing_cycle_anchor\` will be updated to the date/time the threshold was last reached; otherwise, the value will remain unchanged. This value may not be \`true\` if the subscription contains items with plans that have \`aggregate_usage=last_ever\`.`,
      nullable: true
    })
  })
})
