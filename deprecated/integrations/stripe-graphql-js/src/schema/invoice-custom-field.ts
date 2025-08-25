import { builder } from '../builder'

builder.objectType('StripeInvoiceCustomField', {
  fields: (t) => ({
    name: t.exposeString('name', {
      description: `The name of the custom field.`
    }),
    value: t.exposeString('value', {
      description: `The value of the custom field.`
    })
  })
})
