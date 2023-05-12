import { program } from 'commander'
import dotenv from 'dotenv'
import { createBook } from './createBook.mjs'
import { createPATForAccount } from './createPATForAccount.mjs'
import { deleteBook } from './deleteBook.mjs'
import { env } from './env.mjs'
import { logger } from './logger.mjs'
import { client } from './nhostClient.mjs'

dotenv.config()

program
  .name('nhost-bookstore-cli')
  .description('This CLI tool shows how to use the Nhost JS SDK and personal access tokens.')
program
  .option(
    '--token <token>',
    'The personal access token to use. Defaults to the value of the "NHOST_ACCOUNT_PAT" environment variable.'
  )
  .option(
    '--email <email>',
    'The email of the account to use. If both the email and password are provided, a personal access token will be created for the account. Defaults to the value of the "NHOST_ACCOUNT_EMAIL" environment variable.'
  )
  .option(
    '--password <password>',
    'The password of the account to use. If both the email and password are provided, a personal access token will be created for the account. Defaults to the value of the "NHOST_ACCOUNT_PASSWORD" environment variable.'
  )
  .option(
    '--create-token',
    'Whether or not to create a personal access token for the account. If this option is provided, the email and password options must also be provided.'
  )
  .option(
    '--expires-at <date>',
    'The expiration date of the personal access token to create. It will only be used if the "--create-token" option is provided. Defaults to 7 days from now.'
  )
  .option(
    '--token-name <name>',
    'The name of the personal access token to create. It will only be used if the "--create-token" option is provided. This information will be stored as the metadata of the personal access token.'
  )
  .option('--create-book <title>', 'The title of the book to create.')
  .option('--delete-book <id>', 'The ID of the book to delete.')

program.parse()

async function main() {
  const opts = program.opts()
  const envVars = env()

  if (
    Object.keys(opts).length === 0 &&
    !envVars.ACCOUNT_EMAIL &&
    !envVars.ACCOUNT_PASSWORD &&
    !envVars.ACCOUNT_PAT
  ) {
    logger.info('No options were provided. Exiting...')
    return
  }

  let activeToken

  const userProvidedEmail = opts.email || envVars.ACCOUNT_EMAIL
  const userProvidedPassword = opts.password || envVars.ACCOUNT_PASSWORD

  // If the user provided an email and password, create a PAT for the account
  if (opts.createToken && userProvidedEmail && userProvidedPassword) {
    const expiresAt = opts.expiresAt
      ? new Date(opts.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const name = opts.tokenName

    const { error, personalAccessToken } = await createPATForAccount(
      userProvidedEmail,
      userProvidedPassword,
      expiresAt,
      name
    )

    if (error) {
      logger.error(error.message)
      process.exit(1)
    }

    activeToken = personalAccessToken
  }

  const userProvidedToken = opts.token || envVars.ACCOUNT_PAT

  if (!activeToken && !userProvidedToken) {
    logger.error('No personal access token was provided. Exiting...')
    process.exit(1)
  }

  // Use the user-provided token if it exists, otherwise use the PAT that was
  // just created
  activeToken = activeToken || userProvidedToken

  logger.info(`Using PAT: ${activeToken}`)
  logger.debug('Signing in with the personal access token...')

  // Sign in with the personal access token
  const { error: signInError, session } = await client.auth.signInPAT(activeToken)

  if (signInError) {
    logger.error(signInError.message)
    process.exit(1)
  }

  logger.info(
    `Successfully signed in as "${session.user.displayName}" using the personal access token.`
  )

  // Set the access token for the GraphQL client
  client.graphql.setAccessToken(session.accessToken)

  // Create a book if the user provided a title
  if (opts.createBook) {
    const { data, error } = await createBook(opts.createBook, session.user.id)

    if (error) {
      logger.error(Array.isArray(error) ? error[0].message : error.message)
      return
    }

    logger.info(
      `Successfully created book "${data.insert_books_one.title}" with ID "${data.insert_books_one.id}".`
    )
  }

  // Delete a book if the user provided an ID
  if (opts.deleteBook) {
    const { data, error } = await deleteBook(opts.deleteBook)

    if (error) {
      logger.error(Array.isArray(error) ? error[0].message : error.message)
      return
    }

    if (!data.delete_books_by_pk) {
      logger.warn(`No book with ID "${opts.deleteBook}" was found.`)
      return
    }

    logger.info(`Successfully deleted the book with ID "${data.delete_books_by_pk.id}".`)
  }
}

main()
