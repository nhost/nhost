import Stripe from 'stripe'

import { createStripeGraphQLServer } from '../src/index'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2022-08-01'
})

const server = createStripeGraphQLServer({
  context: () => {
    return { stripe }
  }
})

server.start()
