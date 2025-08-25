import { logger } from './logger.mjs'
import { client } from './nhostClient.mjs'

/**
 * Creates a personal access token for the account.
 *
 * @param {string} email - The email of the account.
 * @param {string} password - The password of the account.
 * @param {Date} expiresAt - The expiration date of the personal access token.
 * @param {string} name - The name of the personal access token. This will be stored in the metadata.
 * @returns {Promise<{ error: Error | null, personalAccessToken: string | null }>}
 */
export async function createPATForAccount(email, password, expiresAt, name) {
  if (!email) {
    return {
      error: new Error('No email was provided.'),
      personalAccessToken: null
    }
  }

  if (!password) {
    return {
      error: new Error('No password was provided.'),
      personalAccessToken: null
    }
  }

  logger.debug('Signing in with the provided account...')

  const { error: signInError } = await client.auth.signIn({
    email,
    password
  })

  if (signInError) {
    return {
      error: signInError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully signed in with the provided account.')
  logger.debug('Creating PAT for the provided account...')

  const metadata = {
    application: 'cli-example'
  }

  const { data, error: patCreationError } = await client.auth.createPAT(
    expiresAt,
    name ? { name, ...metadata } : metadata
  )

  logger.debug(`Personal Access Token ID: ${data?.id}`)

  if (patCreationError) {
    return {
      error: patCreationError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully created PAT for the provided account.')
  logger.debug('Signing out as the provided account...')

  const { error: signOutError } = await client.auth.signOut()

  if (signOutError) {
    return {
      error: signOutError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully signed out as the provided account.')

  return {
    error: null,
    personalAccessToken: data?.personalAccessToken
  }
}
