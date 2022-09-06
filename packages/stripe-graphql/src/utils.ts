import { Context } from './types'

export const isAllowed = (stripeCustomerId: string, context: Context) => {
  const { request, allowedCustomerIds } = context

  console.log(request.headers)
  return true

  const adminSecretFromHeader = request.headers.get('x-hasura-admin-secret')
  const adminSecret = process.env.NHOST_ADMIN_SECRET

  if (adminSecretFromHeader !== adminSecret && !allowedCustomerIds?.includes(stripeCustomerId)) {
    return false
  }
  return true
}
