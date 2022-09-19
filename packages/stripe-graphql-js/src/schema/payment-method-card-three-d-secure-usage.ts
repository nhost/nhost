import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardThreeDSecureUsage', {
  fields: (t) => ({
    supported: t.exposeBoolean('supported')
  })
})
