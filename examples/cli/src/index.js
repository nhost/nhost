import { NhostClient } from '@nhost/nhost-js'
import dotenv from 'dotenv'
import pino from 'pino'

dotenv.config()

const client = new NhostClient({
  subdomain: 'local'
})

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
})

/**
 * This function signs in as the service account and creates a new personal
 * access token. Normally you would already have a personal access token
 * created for the service account, but this is just an example.
 *
 * @returns {Promise<{ error: Error | null, personalAccessToken: string | null }>}
 */
async function createPATForServiceAccount() {
  logger.debug('Signing in with the service account...')

  const { error: signInError } = await client.auth.signIn({
    email: process.env.NHOST_SERVICE_ACCOUNT_EMAIL,
    password: process.env.NHOST_SERVICE_ACCOUNT_PASSWORD
  })

  if (signInError) {
    logger.error(signInError.message)

    return {
      error: signInError,
      personalAccessToken: null
    }
  }

  logger.info('Successfully signed in with the service account.')
  logger.debug('Creating PAT for the service account...')

  // TODO: Implement PAT creation

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
    personalAccessToken: '34f74930-09c0-4af5-a8d5-28fad78e3414'
  }
}

async function main() {
  const { error: patError, personalAccessToken } = await createPATForServiceAccount()

  if (patError) {
    logger.error(patError.message)

    return
  }

  logger.debug('Signing in with the personal access token...')

  const { error: signInError } = await client.auth.signInPAT(personalAccessToken)

  if (signInError) {
    logger.error(signInError.message)

    return
  }

  logger.info('Successfully signed in with the personal access token.')

  // TODO: Do something with the client
}

main()
