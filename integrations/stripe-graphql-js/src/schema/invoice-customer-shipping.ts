import { builder } from '../builder'

builder.objectType('StripeInvoiceCustomerShipping', {
  fields: (t) => ({
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    }),
    carrier: t.exposeString('carrier', {
      description: `The delivery service that shipped a physical product, such as Fedex, UPS, USPS, etc.`,
      nullable: true
    }),
    name: t.exposeString('name', {
      description: `Recipient name.`,
      nullable: true
    }),
    phone: t.exposeString('phone', {
      description: `Recipient phone (including extension).`,
      nullable: true
    }),
    trackingNumber: t.exposeString('tracking_number', {
      description: `The tracking number for a physical product, obtained from the delivery service. If multiple tracking numbers were generated for this purchase, please separate them with commas.`,
      nullable: true
    })
  })
})
