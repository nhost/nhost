import { createStripeGraphQLServer } from '../src/index'
import * as dotenv from 'dotenv'
import Stripe from 'stripe'
dotenv.config()

const server = createStripeGraphQLServer({
  context: (context) => {
    const stripe = new Stripe('sk_test_Dn6zEzByo6mDzwd8TMyNMV7A00zXZeszmI', {
      apiVersion: '2022-08-01'
    })

    return {
      stripe,
      ...context
    }
  }
})

server.start()
