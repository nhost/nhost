import { builder } from '../builder'

builder.objectType('StripePaymentMethodCard', {
  fields: (t) => ({
    brand: t.exposeString('brand'),
    check: t.expose('checks', {
      type: 'StripePaymentMethodCardChecks',
      nullable: true
    }),
    country: t.exposeString('country', {
      nullable: true
    }),
    description: t.exposeString('description', {
      nullable: true
    }),
    expMonth: t.exposeInt('exp_month'),
    expYear: t.exposeInt('exp_year'),
    fingerprint: t.exposeString('fingerprint', {
      nullable: true
    }),
    funding: t.exposeString('funding'),
    iin: t.exposeString('iin', {
      nullable: true,
      description: `Issuer identification number of the card. (For internal use only and not typically available in standard API requests.)`
    }),
    issuer: t.exposeString('issuer', {
      nullable: true,
      description: `The name of the card's issuing bank. (For internal use only and not typically available in standard API requests.)`
    }),
    last4: t.exposeString('last4', {
      description: `The last four digits of the card.`
    }),
    networks: t.expose('networks', {
      type: 'StripePaymentMethodCardNetworks',
      nullable: true
    }),
    threeDSecureUsage: t.expose('three_d_secure_usage', {
      type: 'StripePaymentMethodCardThreeDSecureUsage',
      nullable: true
    }),
    wallet: t.expose('wallet', {
      type: 'StripePaymentMethodCardWallet',
      nullable: true
    })
  })
})
