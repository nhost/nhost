import { builder } from '../builder'

builder.objectType('StripeInvoiceLineItem', {
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    amount: t.exposeInt('amount', {
      description: `The amount, in %s.`
    }),
    amountExcludingTax: t.exposeInt('amount_excluding_tax', {
      description: `The integer amount in %s representing the amount for this line item, excluding all tax and discounts.`,
      nullable: true
    }),
    currency: t.exposeString('currency', {
      description: `Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).`
    }),
    description: t.exposeString('description', {
      description: `An arbitrary string attached to the object. Often useful for displaying to users.`,
      nullable: true
    }),
    // todo: discount_amounts
    discountable: t.exposeBoolean('discountable', {
      description: `If true, discounts will apply to this line item. Always false for prorations.`
    }),
    // todo: discounts
    invoiceItem: t.exposeString('invoice_item', {
      description:
        'The ID of the [invoice item](https://stripe.com/docs/api/invoiceitems) associated with this line item if any.',
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Note that for line items with \`type=subscription\` this will reflect the metadata of the subscription that caused the line item to be created.`,
      type: 'JSON'
    }),
    period: t.expose('period', {
      type: 'StripeInvoiceLineItemPeriod'
    }),
    plan: t.expose('plan', {
      description: `The plan of the subscription, if the line item is a subscription or a proration.`,
      type: 'StripePlan',
      nullable: true
    }),
    price: t.expose('price', {
      description: `The price of the line item.`,
      type: 'StripePrice',
      nullable: true
    }),
    proration: t.exposeBoolean('proration', {
      description: `Whether this is a proration.`
    }),
    // todo: proration details
    quantity: t.exposeInt('quantity', {
      description: `The quantity of the subscription, if the line item is a subscription or a proration.`,
      nullable: true
    }),
    // todo: subscription field + resolver
    // todo: subscription_item field + resolver
    taxAmount: t.expose('tax_amounts', {
      description: `The amount of tax calculated per tax rate for this line item`,
      type: ['StripeInvoiceLineItemTaxAmount'],
      nullable: true
    }),
    taxRates: t.expose('tax_rates', {
      description: `The tax rates which apply to the line item.`,
      type: ['StripeTaxRate'],
      nullable: true
    }),
    type: t.exposeString('type', {
      description: `A string identifying the type of the source of this line item, either an \`invoiceitem\` or a \`subscription\`.`
    }),
    unitAmountExcludingTax: t.exposeString('unit_amount_excluding_tax', {
      description: `The amount in %s representing the unit amount for this line item, excluding all tax and discounts.`,
      nullable: true
    })
  })
})
