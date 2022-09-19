import { builder } from '../builder'

builder.objectType('StripeSubscriptionItemBillingThresholds', {
  description: '',
  fields: (t) => ({
    usageGte: t.exposeInt('usage_gte', {
      nullable: true
    })
  })
})
