import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardChecks', {
  fields: (t) => ({
    addressLine1Check: t.exposeString('address_line1_check', {
      description: `If a address line1 was provided, results of the check, one of \`pass\`, \`fail\`, \`unavailable\`, or \`unchecked\`.`,
      nullable: true
    }),
    addressPostalCodeCheck: t.exposeString('address_postal_code_check', {
      description: `If a address postal code was provided, results of the check, one of \`pass\`, \`fail\`, \`unavailable\`, or \`unchecked\`.`,
      nullable: true
    }),
    cvcCheck: t.exposeString('cvc_check', {
      description: `If a CVC was provided, results of the check, one of \`pass\`, \`fail\`, \`unavailable\`, or \`unchecked\`.`,
      nullable: true
    })
  })
})
