import { builder } from '../builder'

builder.objectType('StripePaymentMethodBillingDetails', {
  fields: (t) => ({
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    }),
    email: t.exposeString('email', {
      nullable: true
    }),
    name: t.exposeString('name', {
      nullable: true
    }),
    phone: t.exposeString('phone', {
      nullable: true
    })
  })
})
