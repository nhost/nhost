import { builder } from '../builder'

builder.objectType('StripeCustomerShipping', {
  fields: (t) => ({
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    }),
    carrier: t.exposeString('carrier', {
      nullable: true
    }),
    name: t.exposeString('name', {
      nullable: true
    }),
    phone: t.exposeString('phone', {
      nullable: true
    }),
    trackingNumber: t.exposeString('tracking_number', {
      nullable: true
    })
  })
})
