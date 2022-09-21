import { builder } from '../builder'

builder.objectType('StripeInvoiceStatusTransitions', {
  fields: (t) => ({
    finalizedAt: t.exposeInt('finalized_at', {
      description: 'The time that the invoice draft was finalized.',
      nullable: true
    }),
    markedUncollectibleAt: t.exposeInt('marked_uncollectible_at', {
      description: 'The time that the invoice was marked uncollectible.',
      nullable: true
    }),
    paidAt: t.exposeInt('paid_at', {
      description: 'The time that the invoice was paid.',
      nullable: true
    }),
    voidedAt: t.exposeInt('voided_at', {
      description: 'The time that the invoice was voided.',
      nullable: true
    })
  })
})
