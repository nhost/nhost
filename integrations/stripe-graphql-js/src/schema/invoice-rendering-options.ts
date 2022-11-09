import { builder } from '../builder'

builder.objectType('StripeInvoiceRenderingOptions', {
  fields: (t) => ({
    amountTaxDisplay: t.exposeString('amount_tax_display', {
      description:
        'How line-item prices and amounts will be displayed with respect to tax on invoice PDFs.',
      nullable: true
    })
  })
})
