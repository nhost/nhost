import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItem', {
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    amount: t.exposeInt('amount'),
    amountExcludingTax: t.exposeInt('amount_excluding_tax', {
      nullable: true
    }),
    currency: t.exposeString('currency'),
    description: t.exposeString('description', {
      nullable: true
    }),
    // todo: discount_amounts
    discountable: t.exposeBoolean('discountable'),
    // todo: discounts
    invoiceItem: t.exposeString('invoice_item', {
      description:
        'The ID of the [invoice item](https://stripe.com/docs/api/invoiceitems) associated with this line item if any.',
      nullable: true
    }),

    type: t.exposeString('type')
  })
})
