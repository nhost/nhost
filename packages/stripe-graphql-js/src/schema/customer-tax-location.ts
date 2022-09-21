import { builder } from '../builder'

builder.objectType('StripeCustomerTaxLocation', {
  fields: (t) => ({
    country: t.exposeString('country'),
    // todo: implement correct enum
    // source: t.expose('source', {
    //   type: 'StripeCustomerTaxLocation',
    //   nullable: true
    // }),
    state: t.exposeString('state', {
      nullable: true
    })
  })
})

// namespace Location {
//   type Source = 'billing_address' | 'ip_address' | 'payment_method' | 'shipping_destination'
// }
