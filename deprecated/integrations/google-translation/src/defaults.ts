import graphqlRequest from 'graphql-request'

import { CanTranslate, GetUserLanguage } from './types'

/**
 * Default function to get the user language.
 * It gets the user id from the `x-hasura-user-id` header and
 * returns the user locale from the `auth.users` hasura auth table.
 */
export const defaultGetUserLanguage: GetUserLanguage = async (context, logger) => {
  const userId = context.request.headers.get('x-hasura-user-id')
  if (userId) {
    try {
      const {
        user: { locale }
      } = await graphqlRequest<{ user: { locale: string } }>(
        `${process.env.NHOST_BACKEND_URL}/v1/graphql`,
        `query user($userId: uuid!) { user (id: $userId) { locale } }`,
        { userId },
        { 'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET! }
      )
      if (!locale) {
        logger?.(`No locale set for user ${userId}`)
        return null
      }
      return locale
    } catch (e) {
      const { message } = e as Error
      logger?.(`Error in fetching the user locale ${userId}: ${message}`)
      return null
    }
  }
  return null
}

/**
 * Default function to determine whether the user is allowed to translate.
 * It checks if the request comes from Hasura through the Nhost webhook secret AND EITHER:
 * - the user is an admin
 * - the user is authenticated (has a `x-hasura-user-id` header)
 */
export const defaultCanTranslate: CanTranslate = async ({ request: { headers } }) => {
  const nhostWebhookSecretFromHeader = headers.get('x-nhost-webhook-secret')
  const nhostWebhookSecret = process.env.NHOST_WEBHOOK_SECRET

  const adminSecretFromHeader = headers.get('x-hasura-admin-secret')
  const adminSecret = process.env.NHOST_ADMIN_SECRET

  // Check if the request comes from Hasura through the Nhost webhook secret
  if (nhostWebhookSecretFromHeader !== nhostWebhookSecret) {
    return false
  }

  // Check if the user is an admin
  if (
    adminSecretFromHeader === adminSecret &&
    (headers.get('x-hasura-role') === 'admin' || !headers.get('x-hasura-role'))
  ) {
    return true
  }

  // Check if the user is authenticated
  if (!!headers.get('x-hasura-user-id')) {
    return true
  }

  // Otherwise, the user is not allowed to translate
  return false
}
