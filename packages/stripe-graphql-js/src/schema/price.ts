import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripePrice', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    active: t.exposeBoolean('active'),
    // todo: billing_scheme
    billingScheme: t.exposeString('billing_scheme'),
    created: t.exposeInt('created'),
    currency: t.exposeString('currency'),
    // todo: currency_options
    // todo: custom_unit_amount
    livemode: t.exposeBoolean('livemode'),
    lookupKey: t.exposeString('lookup_key', {
      nullable: true
    }),
    metadata: t.expose('metadata', {
      type: 'JSON',
      nullable: true
    }),
    nickname: t.exposeString('nickname', {
      nullable: true
    }),
    product: t.field({
      type: 'StripeProduct',
      resolve: async (price) => {
        const { product } = price
        const productData = await stripe.products.retrieve(product as string)
        return productData as Stripe.Product
      }
    }),
    // todo: recurring
    // todo: tax_behavior
    // todo: tiers
    tiersMode: t.exposeString('tiers_mode', {
      nullable: true
    }),
    // tiersQuantity: t.exposeString('transform_quantity', {
    //   nullable: true
    // })
    type: t.exposeString('type'),
    unitAmount: t.exposeInt('unit_amount', {
      nullable: true
    }),
    unitAmountDecimal: t.exposeString('unit_amount_decimal', {
      nullable: true
    })
  })
})
