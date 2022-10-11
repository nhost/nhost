import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripePrice', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: 'Unique identifier for the object.'
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    active: t.exposeBoolean('active', {
      description: `Whether the price can be used for new purchases.`
    }),
    // todo: billing_scheme
    billingScheme: t.exposeString('billing_scheme', {
      description: `Describes how to compute the price per period. Either \`per_unit\` or \`tiered\`. \`per_unit\` indicates that the fixed amount (specified in \`unit_amount\` or \`unit_amount_decimal\`) will be charged per unit in \`quantity\` (for prices with \`usage_type=licensed\`), or per unit of total usage (for prices with \`usage_type=metered\`). \`tiered\` indicates that the unit pricing will be computed using a tiering strategy as defined using the \`tiers\` and \`tiers_mode\` attributes.`
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    currency: t.exposeString('currency', {
      description: `Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).`
    }),
    // todo: currency_options
    // todo: custom_unit_amount
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    lookupKey: t.exposeString('lookup_key', {
      description: `A lookup key used to retrieve prices dynamically from a static string. This may be up to 200 characters.`,
      nullable: true
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON',
      nullable: true
    }),
    nickname: t.exposeString('nickname', {
      description: `A brief description of the price, hidden from customers.`,
      nullable: true
    }),
    product: t.field({
      description: `The ID of the product this price is associated with.`,
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
      description: `Defines if the tiering price should be \`graduated\` or \`volume\` based. In \`volume\`-based tiering, the maximum quantity within a period determines the per unit price. In \`graduated\` tiering, pricing can change as the quantity grows.`,
      nullable: true
    }),
    // tiersQuantity: t.exposeString('transform_quantity', {
    //   nullable: true
    // })
    type: t.exposeString('type', {
      description: `One of \`one_time\` or \`recurring\` depending on whether the price is for a one-time purchase or a recurring (subscription) purchase.`
    }),
    unitAmount: t.exposeInt('unit_amount', {
      description: `The unit amount in %s to be charged, represented as a whole integer if possible. Only set if \`billing_scheme=per_unit\`.`,
      nullable: true
    }),
    unitAmountDecimal: t.exposeString('unit_amount_decimal', {
      description: `The unit amount in %s to be charged, represented as a decimal string with at most 12 decimal places. Only set if \`billing_scheme=per_unit\`.`,
      nullable: true
    })
  })
})
