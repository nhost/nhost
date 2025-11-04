import Stripe from 'stripe'

import { GraphQLError } from 'graphql'

import { builder } from '../builder'
import { stripe } from '../utils'

builder.objectType('Stripe', {
  fields: (t) => ({
    connectedAccounts: t.field({
      type: 'StripeConnectedAccounts',
      resolve: async (_parent, _, context) => {
        const { isAdmin } = context

        if (!isAdmin) throw new GraphQLError('Not allowed')

        const connectedAccounts = await stripe.accounts.list()

        return connectedAccounts
      }
    }),
    connectedAccount: t.field({
      type: 'StripeConnectedAccount',
      args: {
        id: t.arg.string({
          required: true
        })
      },
      resolve: async (_parent, { id }, context) => {
        const { isAdmin } = context

        if (!isAdmin) throw new GraphQLError('Not allowed')

        const connectedAccount = await stripe.accounts.retrieve(id)

        return connectedAccount
      }
    }),
    customer: t.field({
      type: 'StripeCustomer',
      args: {
        id: t.arg.string({
          required: true
        })
      },
      resolve: async (_parent, { id }, context) => {
        const { isAllowed } = context

        if (!(await isAllowed(id, context))) {
          throw new GraphQLError('Not allowed')
        }

        const customer = await stripe.customers.retrieve(id)

        if (customer.deleted) {
          throw new GraphQLError('The Stripe customer is deleted')
        }

        return customer
      }
    }),
    customers: t.field({
      type: 'StripeCustomers',
      args: {
        email: t.arg.string({
          description:
            "A case-sensitive filter on the list based on the customer's `email` field. The value must be a string.",
          required: false
        }),
        endingBefore: t.arg.string({
          description:
            'A cursor for use in pagination. `ending_before` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with `obj_bar`, your subsequent call can include `ending_before=obj_bar` in order to fetch the previous page of the list.',
          required: false
        }),
        limit: t.arg.int({
          description:
            'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
          required: false
        }),
        startingAfter: t.arg.string({
          description:
            'A cursor for use in pagination. `starting_after` is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with `obj_foo`, your subsequent call can include `starting_after=obj_foo` in order to fetch the next page of the list.',
          required: false
        })
      },
      resolve: async (_parent, { email, endingBefore, limit, startingAfter }, context) => {
        const { isAllowed } = context

        const customers = await stripe.customers.list({
          email: email || undefined,
          limit: limit || undefined,
          ending_before: endingBefore || undefined,
          starting_after: startingAfter || undefined
        })

        const customerData: Stripe.Customer[] = []
        for (const customer of customers.data) {
          if (await isAllowed(customer.id, context)) {
            customerData.push(customer)
          }
        }

        customers.data = customerData

        return customers
      }
    })
  })
})

builder.objectType('StripeMutations', {
  fields: (t) => ({
    createBillingPortalSession: t.field({
      type: 'StripeBillingPortalSession',
      args: {
        customer: t.arg.string({
          required: true
        }),
        configuration: t.arg.string({
          required: false
        }),
        locale: t.arg.string({
          required: false
        }),
        returnUrl: t.arg.string({
          required: false
        })
      },
      resolve: async (_, { customer, configuration, locale, returnUrl }, context) => {
        const { isAllowed } = context

        if (!(await isAllowed(customer, context))) {
          throw new GraphQLError('Not allowed')
        }

        const session = await stripe.billingPortal.sessions.create({
          customer,
          configuration: configuration || undefined,
          locale: (locale as Stripe.BillingPortal.SessionCreateParams.Locale) || undefined,
          return_url: returnUrl || undefined
        })

        return session
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

builder.mutationFields((t) => ({
  stripe: t.field({
    type: 'StripeMutations',
    resolve: () => ({})
  })
}))
