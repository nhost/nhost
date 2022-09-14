import Stripe from 'stripe'

import { Context } from './types'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY env var is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-08-01'
})

export const isAllowed = (stripeCustomerId: string, context: Context) => {
  const { request, allowedCustomerIds } = context

  const adminSecretFromHeader = request.headers.get('x-hasura-admin-secret')
  const adminSecret = process.env.NHOST_ADMIN_SECRET

  if (adminSecretFromHeader === adminSecret) {
    return true
  }

  if (allowedCustomerIds?.includes(stripeCustomerId)) {
    return true
  }

  // check if the request is from Hasura
  const nhostWebhookSecretFromHeader = request.headers.get('x-nhost-webhook-secret')
  const nhostWebhookSecret = process.env.NHOST_WEBHOOK_SECRET
  const role = request.headers.get('x-hasura-role')

  // if the request is from Hasura, we can trust the `x-hasura-role` header. This is the same as if the request was using the correct admin secret
  if (role === 'admin' && nhostWebhookSecretFromHeader === nhostWebhookSecret) {
    return true
  }

  return false
}
