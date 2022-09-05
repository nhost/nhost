import { GraphQLYogaError } from '@graphql-yoga/node'

import { builder } from '../builder'
import { isAllowed } from '../utils'

builder.objectType('StripeCustomer', {
  description:
    'This object represents a customer of your business. It lets you create recurring charges and track payments that belong to the same customer.',
  fields: (t) => ({
    id: t.exposeID('id'),
    object: t.exposeString('object'),
    balance: t.exposeInt('balance'),
    name: t.exposeString('name', {
      nullable: true
    }),
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    })
    // paymentMethods: t.field({
    //   type: ['StripePaymentMethod'],
    //   nullable: false,
    //   resolve: async (customer, args, ctx) => {
    //     const { data } = await stripe.customers.listPaymentMethods(customer.id, {
    //       type: 'card'
    //     })

    //     return data
    //   }
    // })
  })
})

builder.queryFields((t) => ({
  stripeCustomer: t.field({
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
        throw new Error('Customer is deleted')
      }

      return customer
    }
  })
}))
