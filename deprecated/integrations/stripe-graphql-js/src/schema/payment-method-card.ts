import { builder } from '../builder'

builder.objectType('StripePaymentMethodCard', {
  fields: (t) => ({
    brand: t.exposeString('brand', {
      description: `Card brand. Can be \`amex\`, \`diners\`, \`discover\`, \`jcb\`, \`mastercard\`, \`unionpay\`, \`visa\`, or \`unknown\`.`
    }),
    check: t.expose('checks', {
      description: `Checks on Card address and CVC if provided.`,
      type: 'StripePaymentMethodCardChecks',
      nullable: true
    }),
    country: t.exposeString('country', {
      description: `Two-letter ISO code representing the country of the card. You could use this attribute to get a sense of the international breakdown of cards you've collected.`,
      nullable: true
    }),
    description: t.exposeString('description', {
      description: `A high-level description of the type of cards issued in this range. (For internal use only and not typically available in standard API requests.)`,
      nullable: true
    }),
    expMonth: t.exposeInt('exp_month', {
      description: `Two-digit number representing the card's expiration month.`
    }),
    expYear: t.exposeInt('exp_year', {
      description: `Four-digit number representing the card's expiration year.`
    }),
    fingerprint: t.exposeString('fingerprint', {
      description: `Uniquely identifies this particular card number. You can use this attribute to check whether two customers who've signed up with you are using the same card number, for example. For payment methods that tokenize card information (Apple Pay, Google Pay), the tokenized number might be provided instead of the underlying card number.\n\n*Starting May 1, 2021, card fingerprint in India for Connect will change to allow two fingerprints for the same card --- one for India and one for the rest of the world.*`,
      nullable: true
    }),
    funding: t.exposeString('funding', {
      description: `Card funding type. Can be \`credit\`, \`debit\`, \`prepaid\`, or \`unknown\`.`
    }),
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
      description: `Contains information about card networks that can be used to process the payment.`,
      type: 'StripePaymentMethodCardNetworks',
      nullable: true
    }),
    threeDSecureUsage: t.expose('three_d_secure_usage', {
      description: `Contains details on how this Card maybe be used for 3D Secure authentication.`,
      type: 'StripePaymentMethodCardThreeDSecureUsage',
      nullable: true
    }),
    wallet: t.expose('wallet', {
      description: `If this Card is part of a card wallet, this contains the details of the card wallet.`,
      type: 'StripePaymentMethodCardWallet',
      nullable: true
    })
  })
})
