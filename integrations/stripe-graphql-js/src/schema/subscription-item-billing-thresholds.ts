import { builder } from '../builder'

builder.objectType('StripeSubscriptionItemBillingThresholds', {
  description: '',
  fields: (t) => ({
    usageGte: t.exposeInt('usage_gte', {
      description: `Usage threshold that triggers the subscription to create an invoice`,
      nullable: true
    })
  })
})
