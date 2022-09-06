import { Context } from './types'

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

  if (nhostWebhookSecretFromHeader === nhostWebhookSecret) {
    // if the request is from Hsaura, we can trust the `x-hasura-role` header.
    const role = request.headers.get('x-hasura-role')

    // this is the same as if the request was using the correct admin secret
    if (role === 'admin') {
      return true
    }
  }

  return false
}
