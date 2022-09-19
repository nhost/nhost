import { builder } from '../builder'

builder.objectType('StripeCustomers', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeCustomer'],
      nullable: false
    })
  })
})
