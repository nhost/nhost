import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripePlan', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    active: t.exposeBoolean('active', {
      description: `Whether the plan can be used for new purchases.`
    }),
    aggregateUsage: t.exposeString('aggregate_usage', {
      description: `Specifies a usage aggregation strategy for plans of \`usage_type=metered\`. Allowed values are \`sum\` for summing up all usage during a period, \`last_during_period\` for using the last usage record reported within a period, \`last_ever\` for using the last usage record ever (across period bounds) or \`max\` which uses the usage record with the maximum reported usage during a period. Defaults to \`sum\`.`,
      nullable: true
    }),
    amount: t.exposeInt('amount', {
      description: `The unit amount in %s to be charged, represented as a whole integer if possible. Only set if \`billing_scheme=per_unit\`.`,
      nullable: true
    }),
    amountDecimal: t.exposeString('amount_decimal', {
      description: `The unit amount in %s to be charged, represented as a decimal string with at most 12 decimal places. Only set if \`billing_scheme=per_unit\`.`,
      nullable: true
    }),
    billingScheme: t.exposeString('billing_scheme', {
      description: `Describes how to compute the price per period. Either \`per_unit\` or \`tiered\`. \`per_unit\` indicates that the fixed amount (specified in \`amount\`) will be charged per unit in \`quantity\` (for plans with \`usage_type=licensed\`), or per unit of total usage (for plans with \`usage_type=metered\`). \`tiered\` indicates that the unit pricing will be computed using a tiering strategy as defined using the \`tiers\` and \`tiers_mode\` attributes.`
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    currency: t.exposeString('currency', {
      description: `Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).`
    }),
    interval: t.exposeString('interval', {
      description: `The frequency at which a subscription is billed. One of \`day\`, \`week\`, \`month\` or \`year\`.`
    }),
    intervalCount: t.exposeInt('interval_count', {
      description: `The number of intervals (specified in the \`interval\` attribute) between subscription billings. For example, \`interval=month\` and \`interval_count=3\` bills every 3 months.`
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON',
      nullable: true
    }),
    nickname: t.exposeString('nickname', {
      description: `A brief description of the plan, hidden from customers.`,
      nullable: true
    }),
    product: t.field({
      description: `The product whose pricing this plan determines.`,
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
      description: `Defines if the tiering price should be \`graduated\` or \`volume\` based. In \`volume\`-based tiering, the maximum quantity within a period determines the per unit price. In \`graduated\` tiering, pricing can change as the quantity grows.`,
      nullable: true
    }),
    transformUsage: t.expose('transform_usage', {
      description: `Apply a transformation to the reported usage or set quantity before computing the amount billed. Cannot be combined with \`tiers\`.`,
      type: 'StripePlanTransformUsage',
      nullable: true
    }),
    trialPeriodDays: t.exposeInt('trial_period_days', {
      description: `Default number of trial days when subscribing a customer to this plan using [\`trial_from_plan=true\`](https://stripe.com/docs/api#create_subscription-trial_from_plan).`,
      nullable: true
    }),
    usageType: t.exposeString('usage_type', {
      description: `Configures how the quantity per period should be determined. Can be either \`metered\` or \`licensed\`. \`licensed\` automatically bills the \`quantity\` set when adding it to a subscription. \`metered\` aggregates the total usage based on usage records. Defaults to \`licensed\`.`
    })
  })
})
