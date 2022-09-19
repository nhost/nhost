import { builder } from '../builder'

builder.objectType('StripeAddress', {
  fields: (t) => ({
    line1: t.exposeString('line1', { nullable: true }),
    line2: t.exposeString('line2', { nullable: true }),
    postalCode: t.exposeString('postal_code', { nullable: true }),
    city: t.exposeString('city', { nullable: true }),
    state: t.exposeString('state', { nullable: true }),
    country: t.exposeString('country', { nullable: true })
  })
})
