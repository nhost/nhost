import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItemPeriod', {
  fields: (t) => ({
    start: t.exposeInt('start'),
    end: t.exposeInt('end')
  })
})
