import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripeProduct', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    active: t.exposeBoolean('active', {
      description: `Whether the product is currently available for purchase.`
    }),
    attributes: t.exposeStringList('attributes', {
      description: `A list of up to 5 attributes that each SKU can provide values for (e.g., \`["color", "size"]\`).`,
      nullable: true
    }),
    caption: t.exposeString('caption', {
      description: `A short one-line description of the product, meant to be displayable to the customer. Only applicable to products of \`type=good\`.`,
      nullable: true
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    deactivateOn: t.exposeStringList('deactivate_on', {
      description: `An array of connect application identifiers that cannot purchase this product. Only applicable to products of \`type=good\`.`,
      nullable: true
    }),
    defaultPrice: t.field({
      description: `The ID of the [Price](https://stripe.com/docs/api/prices) object that is the default price for this product.`,
      type: 'StripePrice',
      nullable: true,
      resolve: async (product) => {
        const { default_price } = product
        if (!default_price) {
          return null
        }

        const price = await stripe.prices.retrieve(default_price as string)

        if (!price) {
          return null
        }

        return price as Stripe.Price
      }
    }),
    description: t.exposeString('description', {
      description: `The product's description, meant to be displayable to the customer. Use this field to optionally store a long form explanation of the product being sold for your own rendering purposes.`,
      nullable: true
    }),
    images: t.exposeStringList('images', {
      description: `A list of up to 8 URLs of images for this product, meant to be displayable to the customer.`,
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON',
      nullable: true
    }),
    name: t.exposeString('name', {
      description: `The product's name, meant to be displayable to the customer.`
    }),
    // todo: pacakge dimentions
    // todo: fix typo here -> shippable
    sippable: t.exposeBoolean('shippable', {
      description: `Whether this product is shipped (i.e., physical goods).`,
      nullable: true
    }),
    statementDescriptor: t.exposeString('statement_descriptor', {
      description: `Extra information about a product which will appear on your customer's credit card statement. In the case that multiple products are billed at once, the first statement descriptor will be used.`,
      nullable: true
    }),
    // todo: tax code
    type: t.exposeString('type', {
      description: `The type of the product. The product is either of type \`good\`, which is eligible for use with Orders and SKUs, or \`service\`, which is eligible for use with Subscriptions and Plans.`
    }),
    unitLabel: t.exposeString('unit_label', {
      description: `A label that represents units of this product in Stripe and on customers' receipts and invoices. When set, this will be included in associated invoice line item descriptions.`,
      nullable: true
    }),
    updated: t.exposeInt('updated', {
      description: `Time at which the object was last updated. Measured in seconds since the Unix epoch.`
    }),
    url: t.exposeString('url', {
      description: `A URL of a publicly-accessible webpage for this product.`,
      nullable: true
    })
  })
})
