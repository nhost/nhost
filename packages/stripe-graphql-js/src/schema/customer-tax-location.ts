import { builder } from '../builder'

builder.objectType('StripeCustomerTaxLocation', {
  fields: (t) => ({
    country: t.exposeString('country', {
      description: `The customer's country as identified by Stripe Tax.`
    }),
    // todo: implement correct enum
    // source: t.expose('source', {
    //   type: 'StripeCustomerTaxLocation',
    //   nullable: true
    // }),
    state: t.exposeString('state', {
      description: `The customer's state, county, province, or region as identified by Stripe Tax.`,
      nullable: true
    })
  })
})

// namespace Location {
//   type Source = 'billing_address' | 'ip_address' | 'payment_method' | 'shipping_destination'
// }
