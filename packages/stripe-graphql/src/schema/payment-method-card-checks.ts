import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardChecks', {
  fields: (t) => ({
    addressLine1Check: t.exposeString('address_line1_check', {
      nullable: true
    }),
    addressPostalCodeCheck: t.exposeString('address_postal_code_check', {
      nullable: true
    }),
    cvcCheck: t.exposeString('cvc_check', {
      nullable: true
    })
  })
})
