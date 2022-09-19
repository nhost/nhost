import { builder } from '../builder'

builder.objectType('StripePaymentMethodCardWallet', {
  fields: (t) => ({
    dynamicLast4: t.exposeString('dynamic_last4', {
      nullable: true
    }),
    masterpass: t.expose('masterpass', {
      type: 'StripePaymentMethodCardWalletMasterpass',
      nullable: true
    }),
    type: t.expose('type', { type: 'StripePaymentMethodCardWalletType' }),
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
