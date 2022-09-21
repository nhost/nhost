import Stripe from 'stripe'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('StripeProduct', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    active: t.exposeBoolean('active'),
    attributes: t.exposeStringList('attributes', {
      nullable: true
    }),
    caption: t.exposeString('caption', {
      nullable: true
    }),
    created: t.exposeInt('created'),
    deactivateOn: t.exposeStringList('deactivate_on', {
      nullable: true
    }),
    defaultPrice: t.field({
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
      nullable: true
    }),
    images: t.exposeStringList('images', {
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON',
      nullable: true
    }),
    name: t.exposeString('name'),
    // todo: pacakge dimentions
    sippable: t.exposeBoolean('shippable', {
      nullable: true
    }),
    statementDescriptor: t.exposeString('statement_descriptor', {
      nullable: true
    }),
    // todo: tax code
    type: t.exposeString('type'),
    unitLabel: t.exposeString('unit_label', {
      nullable: true
    }),
    updated: t.exposeInt('updated'),
    url: t.exposeString('url', {
      nullable: true
    })
  })
})
