import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardWalletVisaCheckout', {
  fields: (t) => ({
    billingAddress: t.expose('billing_address', {
      type: 'StripeAddress',
      nullable: true
    }),
    email: t.exposeString('email', {
      nullable: true
    }),
    name: t.exposeString('name', {
      nullable: true
    }),
    shippinAddress: t.expose('shipping_address', {
      type: 'StripeAddress',
      nullable: true
    })
  })
})
