import { builder } from '../builder'

builder.objectType('StripeConnectedAccounts', {
  description: 'List of Stripe Connected Account objects',
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeConnectedAccount'],
      nullable: false
    })
  })
})
