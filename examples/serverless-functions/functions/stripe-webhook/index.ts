/*

- How to receive Stripe Webhooks. Read more about Stripe Webhooks here: https://stripe.com/docs/webhooks.
- Make sure to configure your Stripe Webhook URL in the Stripe Dashboard: https://dashboard.stripe.com/webhooks.
- You can test your Stripe Webhook by using the Stripe CLI: https://stripe.com/docs/stripe-cli.
- Make sure to configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in your `.env.development` file during local development. In production, use the `Environment Variables` tab in the Nhost Dashboard.

Test:

URL: http://localhost:1337/v1/functions/stripe-webhook
*/

import { Request, Response } from 'express'

import Stripe from 'stripe'

type NhostResponse = Response
type NhostRequest = Request & {
  rawBody: string
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-08-01'
})

export default async function handler(req: NhostRequest, res: NhostResponse) {
  const sig = req.headers['stripe-signature'] as string
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  // Match the raw body to content type application/json
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret)
  } catch (err: any) {
    console.log(`⚠️  Webhook signature verification failed.`)
    console.log(err)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (!event) {
    console.log('no event found')
    return res.status(400).send('No event')
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created': {
      const { object } = event.data as any
      console.log('customer subscription created!')
      console.log(object)
      break
    }
    case 'customer.subscription.deleted': {
      const { object } = event.data as any
      console.log('customer subscription deleted!')
      console.log(object)
    }
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`)
  }

  res.json({ received: true })
}
