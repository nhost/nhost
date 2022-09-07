import { GraphQLYogaError } from '@graphql-yoga/node'

import { builder } from '../builder'
import { isAllowed } from '../utils'

builder.objectType('Stripe', {
  fields: (t) => ({
    customer: t.field({
      type: 'StripeCustomer',
      args: {
        id: t.arg.string({
          required: true
        })
      },
      resolve: async (_parent, { id }, context) => {
        if (!isAllowed(id, context)) {
          throw new GraphQLYogaError('user is not allowed to see info from this stripe id')
        }

        const { stripe } = context

        const customer = await stripe.customers.retrieve(id)

        if (customer.deleted) {
          throw new GraphQLYogaError('customer is deleted')
        }

        return customer
      }
    })
  })
})

builder.queryFields((t) => ({
  stripe: t.field({
    type: 'Stripe',
    resolve: () => ({})
  })
}))
