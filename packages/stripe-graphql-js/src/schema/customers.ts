import { builder } from '../builder'

builder.objectType('StripeCustomers', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url', {
      description: `The URL where this list can be accessed.`
    }),
    hasMore: t.exposeBoolean('has_more', {
      description: `True if this list has another page of items after this one that can be fetched.`
    }),
    data: t.expose('data', {
      type: ['StripeCustomer'],
      nullable: false
    })
  })
})
