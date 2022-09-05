import { builder } from '../builder'

builder.objectType('StripeAddress', {
  fields: (t) => ({
    city: t.exposeString('city', { nullable: true }),
    country: t.exposeString('country', { nullable: true }),
    line1: t.exposeString('line1', { nullable: true }),
    line2: t.exposeString('line2', { nullable: true }),
    postal_code: t.exposeString('postal_code', { nullable: true }),
    state: t.exposeString('state', { nullable: true }),
    postalCode: t.field({
      type: 'String',
      description: 'my cool des',
      nullable: true,
      resolve: (parent) => parent.postal_code
    })
  })
})
