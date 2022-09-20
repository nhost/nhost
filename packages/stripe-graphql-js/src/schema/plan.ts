import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripePlan', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    active: t.exposeBoolean('active'),
    aggregateUsage: t.exposeString('aggregate_usage', {
      nullable: true
    }),
    amount: t.exposeInt('amount', {
      nullable: true
    }),
    amountDecimal: t.exposeString('amount_decimal', {
      nullable: true
    }),
    billingScheme: t.exposeString('billing_scheme'),
    created: t.exposeInt('created'),
    currency: t.exposeString('currency'),
    interval: t.exposeString('interval'),
    intervalCount: t.exposeInt('interval_count'),
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON',
      nullable: true
    }),
    nickname: t.exposeString('nickname', {
      nullable: true
    }),
    product: t.field({
      type: 'StripeProduct',
      nullable: true,
      resolve: async (price) => {
        const { product } = price

        if (!product) {
          return null
        }

        const productData = await stripe.products.retrieve(product as string)
        return productData as Stripe.Product
      }
    }),
    // toddo: tiers
    // todo: tiers
    tiersMode: t.exposeString('tiers_mode', {
      nullable: true
    }),
    transformUsage: t.expose('transform_usage', {
      type: 'StripePlanTransformUsage',
      nullable: true
    }),
    trialPeriodDays: t.exposeInt('trial_period_days', {
      nullable: true
    }),
    usageType: t.exposeString('usage_type')
  })
})
