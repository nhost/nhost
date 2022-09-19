import { builder } from '../builder'

builder.objectType('StripeSubscriptions', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeSubscription'],
      nullable: false
    })
  })
})
