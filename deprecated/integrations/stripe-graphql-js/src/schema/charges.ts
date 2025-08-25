import { builder } from '../builder'

builder.objectType('StripeCharges', {
  description: 'List of Stripe charge objects',
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeCharge'],
      nullable: false
    })
  })
})
