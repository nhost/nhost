import { env } from './env.mjs'
import { logger } from './logger.mjs'
import { client } from './nhostClient.mjs'

/**
 * This function signs in as the service account and creates a new personal
 * access token. Normally you would already have a personal access token
 * created for the service account, but this is just an example.
 *
 * @returns {Promise<{ error: Error | null, personalAccessToken: string | null }>}
 */
export async function createPATForServiceAccount() {
  const envVars = env()

  if (envVars.SERVICE_ACCOUNT_PAT) {
    logger.info('Skipping PAT creation. Reason: PAT was provided as an environment variable.')

    return {
      error: null,
      personalAccessToken: envVars.SERVICE_ACCOUNT_PAT
    }
  }

  logger.debug('Signing in with the service account...')

  const { error: signInError } = await client.auth.signIn({
    email: envVars.SERVICE_ACCOUNT_EMAIL,
    password: envVars.SERVICE_ACCOUNT_PASSWORD
  })

  if (signInError) {
    return {
      error: signInError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully signed in with the service account.')
  logger.debug('Creating PAT for the service account...')

  const { error: patCreationError, personalAccessToken } = await client.auth.createPAT(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  )

  if (patCreationError) {
    return {
      error: patCreationError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully created PAT for the service account.')
  logger.debug('Signing out as the service account...')

  const { error: signOutError } = await client.auth.signOut()

  if (signOutError) {
    return {
      error: signOutError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully signed out as the service account.')

  return {
    error: null,
    personalAccessToken
  }
}
