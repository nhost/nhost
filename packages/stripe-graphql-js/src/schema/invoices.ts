import { builder } from '../builder'

builder.objectType('StripeInvoices', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeInvoice'],
      nullable: false
    })
  })
})
