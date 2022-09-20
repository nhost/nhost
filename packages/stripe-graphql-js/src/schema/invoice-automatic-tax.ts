import { builder } from '../builder'

builder.objectType('StripeInvoiceAutomaticTax', {
  fields: (t) => ({
    enabled: t.exposeBoolean('enabled'),
    status: t.exposeString('status', {
      nullable: true
    })
  })
})
