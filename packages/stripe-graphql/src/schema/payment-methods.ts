import { builder } from '../builder'

builder.objectType('StripePaymentMethods', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripePaymentMethod'],
      nullable: false
    })
  })
})

// TODO: generic args for payment methods
// export const paymentMethodsArgs = builder.args((t) => ({
//   type: t({ // unable to get this to work
//     type: PaymentMethodTypes,
//     required: true,
//     defaultValue: 'card'
//   }),
//   startingAfter: t.string({
//     required: false
//   }),
//   endingBefore: t.string({
//     required: false
//   }),
//   limit: t.int({
//     required: false
//   })
// }))

export const StripePaymentMethodTypes = builder.enumType('StripePaymentMethodTypes', {
  values: {
    ACSS_DEBIT: { value: 'acss_debit' },
    AFFIRM: { value: 'affirm' },
    AFTERPAY_CLEARPAY: { value: 'afterpay_clearpay' },
    ALIPAY: { value: 'alipay' },
    AU_BECS_DEBIT: { value: 'au_becs_debit' },
    BACS_DEBIT: { value: 'bacs_debit' },
    BANCONTACT: { value: 'bancontact' },
    BLIK: { value: 'blik' },
    BOLETO: { value: 'boleto' },
    CARD: { value: 'card' },
    CARD_PRESENT: { value: 'card_present' },
    CUSTOMER_BALANCE: { value: 'customer_balance' },
    EPS: { value: 'eps' },
    FPX: { value: 'fpx' },
    GIROPAY: { value: 'giropay' },
    GRABPAY: { value: 'grabpay' },
    IDEAL: { value: 'ideal' },
    KLARNA: { value: 'klarna' },
    KONBINI: { value: 'konbini' },
    LINK: { value: 'link' },
    OXXO: { value: 'oxxo' },
    P24: { value: 'p24' },
    PAYNOW: { value: 'paynow' },
    PROMPTPAY: { value: 'promptpay' },
    SEPA_DEBIT: { value: 'sepa_debit' },
    SOFORT: { value: 'sofort' },
    US_BANK_ACCOUNT: { value: 'us_bank_account' },
    WECHAT_PAY: { value: 'wechat_pay' }
  } as const
})
