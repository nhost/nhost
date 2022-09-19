import { builder } from '../builder'

builder.objectType('StripePrice', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    active: t.exposeBoolean('active'),
    // todo: billing_scheme
    created: t.exposeInt('created'),
    currency: t.exposeString('currency')
    // todo: currency_options
    // todo: custom_unit_amount
  })
})
