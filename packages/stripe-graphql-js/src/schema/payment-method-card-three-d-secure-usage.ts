import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardThreeDSecureUsage', {
  fields: (t) => ({
    supported: t.exposeBoolean('supported', {
      description: `Whether 3D Secure is supported on this card.`
    })
  })
})
