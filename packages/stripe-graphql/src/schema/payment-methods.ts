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

export const PaymentMethodTypes = builder.enumType('PaymentMethodTypes', {
  values: [
    'acss_debit',
    'affirm',
    'afterpay_clearpay',
    'alipay',
    'au_becs_debit',
    'bacs_debit',
    'bancontact',
    'blik',
    'boleto',
    'card',
    'card_present',
    'customer_balance',
    'eps',
    'fpx',
    'giropay',
    'grabpay',
    'ideal',
    'klarna',
    'konbini',
    'link',
    'oxxo',
    'p24',
    'paynow',
    'promptpay',
    'sepa_debit',
    'sofort',
    'us_bank_account',
    'wechat_pay'
  ] as const
})
