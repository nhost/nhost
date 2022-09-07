import { builder } from '../builder'

builder.objectType('StripePaymentMethod', {
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    // todo
    created: t.exposeInt('created'),
    // customer: t.expose('customer', {
    //   type: 'String',
    //   nullable: true
    // }),
    livemode: t.exposeBoolean('livemode')
    // metadata: t.expose('metadata', {
    //   type: 'StripeMetadata',
    //   nullable: true
    // })
    // TODO: Type
    // type: t.expose('type', { type: 'StripePaymentMethodTypes' })
  })
})
