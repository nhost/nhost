import * as dotenv from 'dotenv'
import { GraphQLScalarType } from 'graphql'
import Stripe from 'stripe'

import { CORSOptions, createServer, GraphQLYogaError, YogaInitialContext } from '@graphql-yoga/node'

dotenv.config()

export type StripeGraphQLInitialContext = YogaInitialContext
export type StripeGraphQLContext = {
  stripe: Stripe
  allowedStripeCustomerIds?: string[]
}

type Context = YogaInitialContext & StripeGraphQLContext

type StripeInvoicesProps = {
  stripeCustomerId: string
}

type StripePaymentMethodsProps = {
  stripeCustomerId: string
}

const uuid = new GraphQLScalarType({
  name: 'uuid',
  description: 'uuid desc'
})

const isAllowed = (stripeCustomerId: string, context: Context) => {
  const { request, allowedStripeCustomerIds } = context

  const adminSecretFromHeader = request.headers.get('x-hasura-admin-secret')
  const adminSecret = process.env.NHOST_ADMIN_SECRET

  if (
    adminSecretFromHeader !== adminSecret &&
    !allowedStripeCustomerIds?.includes(stripeCustomerId)
  ) {
    return false
  }
  return true
}

const typeDefs = `#graphql
  scalar uuid

  type Query {
    stripeInvoices(stripeCustomerId: String!): [StripeInvoices]
    stripePaymentMethods(stripeCustomerId: String!): [StripePaymentMethod]
  }

  type StripeInvoices {
    id: String
    createdAt: String
    paid: Boolean
    amountPaid: Int
    amountDue: Int
    amountRemaining: Int
    currency: String
  }

  type StripePaymentMethod {
    id: String!
    created: String!
    card: StripePaymentMethodCard
    type: String!
  }

  type StripePaymentMethodCard {
    brand: String!
    country: String
    exp_month: Int
    exp_year: Int
    last4: String!
  }
`

const resolvers = {
  Query: {
    stripeInvoices: async (_: unknown, args: StripeInvoicesProps, context: Context) => {
      const { stripeCustomerId } = args
      const { stripe } = context

      if (!isAllowed(stripeCustomerId, context)) {
        throw new GraphQLYogaError('user is not allowed to see info from this stripe id')
      }

      const { data: invoices } = await stripe.invoices.list({
        customer: stripeCustomerId
      })

      return invoices.map((invoice) => {
        return {
          id: invoice.id,
          createdAt: invoice.created,
          paid: invoice.paid,
          amountPaid: invoice.amount_paid,
          amountDue: invoice.amount_due,
          amountRemaining: invoice.amount_remaining
        }
      })
    },
    stripePaymentMethods: async (_: unknown, args: StripePaymentMethodsProps, context: Context) => {
      const { stripeCustomerId } = args
      const { stripe } = context

      if (!isAllowed(stripeCustomerId, context)) {
        throw new GraphQLYogaError('user is not allowed to see info from this stripe id')
      }

      const paymentMethods = await stripe.customers.listPaymentMethods(stripeCustomerId, {
        type: 'card'
      })

      return paymentMethods.data.map((paymentMethod) => {
        return paymentMethod
      })
    }
  },
  uuid
}

type CreateServerProps = {
  cors?: CORSOptions
  context: (params: YogaInitialContext) => StripeGraphQLContext
}

const createStripeGraphQLServer = (props: CreateServerProps) => {
  const { cors, context } = props

  return createServer({
    cors: cors ? cors : false,
    context,
    schema: {
      typeDefs,
      resolvers
    }
  })
}

export { createStripeGraphQLServer, resolvers, typeDefs }
