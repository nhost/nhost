import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardWallet', {
  fields: (t) => ({
    dynamicLast4: t.exposeString('dynamic_last4', {
      description: `(For tokenized numbers only.) The last four digits of the device account number.`,
      nullable: true
    }),
    masterpass: t.expose('masterpass', {
      type: 'StripePaymentMethodCardWalletMasterpass',
      nullable: true
    }),
    type: t.expose('type', { 
      description: `The type of the card wallet, one of \`amex_express_checkout\`, \`apple_pay\`, \`google_pay\`, \`masterpass\`, \`samsung_pay\`, or \`visa_checkout\`. An additional hash is included on the Wallet subhash with a name matching this value. It contains additional information specific to the card wallet type.`,
      type: 'StripePaymentMethodCardWalletType' 
    }),
    visaCheckout: t.expose('visa_checkout', {
      type: 'StripePaymentMethodCardWalletVisaCheckout',
      nullable: true
    })
  })
})

export const StripePaymentMethodCardWalletType = builder.enumType(
  'StripePaymentMethodCardWalletType',
  {
    values: [
      'amex_express_checkout',
      'apple_pay',
      'google_pay',
      'masterpass',
      'samsung_pay',
      'visa_checkout'
    ] as const
  }
)
