import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItemTaxAmount', {
  fields: (t) => ({
    amount: t.exposeInt('amount'),
    inclusive: t.exposeBoolean('inclusive')
    // todo: tax rate
    // issues because tax_rate can be a string or TaxRate
    // taxRate: t.expose('tax_rate', {
    //   type: 'StripeTaxRate'
    // })
  })
})
