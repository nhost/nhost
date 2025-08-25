import { builder } from '../builder'

builder.objectType('StripeAddress', {
  fields: (t) => ({
    line1: t.exposeString('line1', { 
      description: `Block/Building number.`,
      nullable: true 
    }),
    line2: t.exposeString('line2', { 
      description: `Building details.`,
      nullable: true 
    }),
    postalCode: t.exposeString('postal_code', { 
      description: `ZIP or postal code.`,
      nullable: true 
    }),
    city: t.exposeString('city', { 
      description: `City/Ward.`,
      nullable: true 
    }),
    state: t.exposeString('state', { 
      description: `Prefecture.`,
      nullable: true 
    }),
    country: t.exposeString('country', { 
      description: `Two-letter country code ([ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)).`,
      nullable: true 
    })
  })
})
