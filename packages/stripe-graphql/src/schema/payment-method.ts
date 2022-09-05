import { builder } from '../builder'

builder.objectType('StripePaymentMethod', {
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    created: t.exposeInt('created'),
    livemode: t.exposeBoolean('livemode')
  })
})
