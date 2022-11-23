import { builder } from '../builder'

builder.objectType('StripeSubscriptionAutomaticTax', {
  description: '',
  fields: (t) => ({
    enabled: t.exposeBoolean('enabled', {
      description: `Whether Stripe automatically computes tax on this subscription.`
    })
  })
})
