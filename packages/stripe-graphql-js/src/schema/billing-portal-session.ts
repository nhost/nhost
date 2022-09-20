import { builder } from '../builder'

builder.objectType('StripeBillingPortalSession', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    // todo: configuration
    created: t.exposeInt('created'),
    // todo: customer
    livemode: t.exposeBoolean('livemode'),
    locale: t.exposeString('locale', {
      nullable: true
    }),
    // todo: on behalf of
    returnUrl: t.exposeString('return_url', {
      nullable: true
    }),
    url: t.exposeString('url')
  })
})
