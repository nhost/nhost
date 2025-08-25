import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardNetworks', {
  fields: (t) => ({
    available: t.exposeStringList('available', {
      description: `All available networks for the card.`
    }),
    preferred: t.exposeString('preferred', {
      description: `The preferred network for the card.`,
      nullable: true
    })
  })
})
