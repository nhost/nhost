import { builder } from '../builder'

builder.objectType('StripeSubscriptionAutomaticTax', {
  description: '',
  fields: (t) => ({
    enabled: t.exposeBoolean('enabled')
  })
})
