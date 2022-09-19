import { builder } from '../builder'

builder.objectType('StripeCustomerTax', {
  fields: (t) => ({
    // todo: implement correct enum
    // automaticTax: t.expose('automatic_tax', {
    //   type: 'StripeCustomerTaxAutomaticTax',
    //   nullable: true
    // }),
    ipAddress: t.exposeString('ip_address', {
      nullable: true
    }),
    location: t.expose('location', {
      type: 'StripeCustomerTaxLocation',
      nullable: true
    })
  })
})

// type AutomaticTax = 'failed' | 'not_collecting' | 'supported' | 'unrecognized_location'
