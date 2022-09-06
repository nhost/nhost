import { builder } from '../builder'

builder.objectType('StripeSubscription', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    created: t.exposeInt('created')
  })
})
