import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItemTaxAmount', {
  fields: (t) => ({
    amount: t.exposeInt('amount', {
      description: `The amount, in %s, of the tax.`
    }),
    inclusive: t.exposeBoolean('inclusive', {
      description: `Whether this tax amount is inclusive or exclusive.`
    })
    // todo: tax rate
    // issues because tax_rate can be a string or TaxRate
    // taxRate: t.expose('tax_rate', {
    //   type: 'StripeTaxRate'
    // })
  })
})
