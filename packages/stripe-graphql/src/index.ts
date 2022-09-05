import * as dotenv from 'dotenv'
import { GraphQLScalarType } from 'graphql'
import Stripe from 'stripe'

import { CORSOptions, createServer, GraphQLYogaError, YogaInitialContext } from '@graphql-yoga/node'

dotenv.config()

export type StripeGraphQLInitialContext = YogaInitialContext
export type StripeGraphQLContext = {
  allowedcustomerIds?: string[]
}

type Context = YogaInitialContext & StripeGraphQLContext

type StripeCustomerProps = {
  customerId: string
}

type StripeInvoicesProps = {
  customerId: string
}

type StripePaymentMethodsProps = {
  customerId: string
}

const uuid = new GraphQLScalarType({
  name: 'uuid',
  description: 'uuid desc'
})

const isAllowed = (customerId: string, context: Context) => {
  const { request, allowedcustomerIds } = context

  const adminSecretFromHeader = request.headers.get('x-hasura-admin-secret')
  const adminSecret = process.env.NHOST_ADMIN_SECRET

  if (adminSecretFromHeader !== adminSecret && !allowedcustomerIds?.includes(customerId)) {
    return false
  }
  return true
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-08-01'
})

const typeDefs = `#graphql
  scalar uuid
  scalar JSON

  type Query {
    stripeCustomer(customerId: String!): StripeCustomer
    stripeInvoices(customerId: String!): [StripeInvoices]
    stripePaymentMethods(customerId: String!): [StripePaymentMethod]
  }

  type StripeCustomer {
    id: String!
    object: String!
    address: StripeAddress
    balance: Int!
    created: Int!
    """
    Three-letter [ISO code for the currency](https://stripe.com/docs/currencies) the customer can be charged in for recurring billing purposes.
    """
    currency: String
    deleted: Boolean
    delinquent: Boolean
    description: String
    email: String
    invoice_prefix: String
    livemode: Boolean
    metadata: JSON
    name: String
    next_invoice_sequence: Int
    phone: String
  }

  type StripeAddress {
    city: String
    country: String
    line1: String
    line2: String
    postal_code: String
    state: String
  }

  type StripeInvoices {
    id: String!
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
    stripeCustomer: async (_: unknown, args: StripeCustomerProps, context: Context) => {
      const { customerId } = args

      const customer = await stripe.customers.retrieve(customerId)

      console.log(JSON.stringify(customer, null, 2))

      return customer
    },
    stripeInvoices: async (_: unknown, args: StripeInvoicesProps, context: Context) => {
      const { customerId } = args

      if (!isAllowed(customerId, context)) {
        throw new GraphQLYogaError('user is not allowed to see info from this stripe id')
      }

      const { data: invoices } = await stripe.invoices.list({
        customer: customerId
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
      const { customerId } = args

      if (!isAllowed(customerId, context)) {
        throw new GraphQLYogaError('user is not allowed to see info from this stripe id')
      }

      const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
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
