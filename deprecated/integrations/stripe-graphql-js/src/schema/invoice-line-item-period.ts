import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItemPeriod', {
  fields: (t) => ({
    start: t.exposeInt('start', {
      description: `The start of the period.`
    }),
    end: t.exposeInt('end', {
      description: `The end of the period, which must be greater than or equal to the start.`
    })
  })
})
