import { builder } from '../builder'

builder.objectType('StripeInvoiceCustomerTaxId', {
  fields: (t) => ({
    type: t.exposeString('type'),
    value: t.exposeString('value', {
      nullable: true
    })
  })
})
