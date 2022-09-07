import { builder } from '../builder'

import { StripePaymentMethodTypes } from './payment-methods'

builder.objectType('StripePaymentMethod', {
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    // todo
    created: t.exposeInt('created'),
    customer: t.expose('customer', {
      type: 'String',
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode'),
    // TODO: metadata
    type: t.expose('type', { type: StripePaymentMethodTypes })
  })
})
