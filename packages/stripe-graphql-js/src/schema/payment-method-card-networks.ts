import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardNetworks', {
  fields: (t) => ({
    available: t.exposeStringList('available'),
    preferred: t.exposeString('preferred', {
      nullable: true
    })
  })
})
