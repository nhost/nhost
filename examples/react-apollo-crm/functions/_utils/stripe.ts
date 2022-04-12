import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SK, {
  apiVersion: '2020-08-27'
})

export { stripe }
