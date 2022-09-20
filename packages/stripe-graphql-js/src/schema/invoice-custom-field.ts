import { builder } from '../builder'

builder.objectType('StripeInvoiceCustomField', {
  fields: (t) => ({
    name: t.exposeString('name'),
    value: t.exposeString('value')
  })
})
