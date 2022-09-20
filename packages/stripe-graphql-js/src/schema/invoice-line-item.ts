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
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    period: t.expose('period', {
      type: 'StripeInvoiceLineItemPeriod'
    }),
    plan: t.expose('plan', {
      type: 'StripePlan',
      nullable: true
    }),
    price: t.expose('price', {
      type: 'StripePrice',
      nullable: true
    }),
    proration: t.exposeBoolean('proration'),
    // todo: proration details
    quantity: t.exposeInt('quantity', {
      nullable: true
    }),
    // todo: subscription field + resolver
    // todo: subscription_item field + resolver
    taxAmount: t.expose('tax_amounts', {
      type: ['StripeInvoiceLineItemTaxAmount'],
      nullable: true
    }),
    taxRates: t.expose('tax_rates', {
      type: ['StripeTaxRate'],
      nullable: true
    }),
    type: t.exposeString('type'),
    unitAmountExcludingTax: t.exposeString('unit_amount_excluding_tax', {
      nullable: true
    })
  })
})
