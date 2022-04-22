import Stripe from 'stripe'

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SK, {
  apiVersion: '2020-08-27'
})

export { stripe }
