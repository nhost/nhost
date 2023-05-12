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
  .option('--token <token>', 'The personal access token to use.')
  .option('--create-book <title>', 'The title of the book to create.')
  .option('--delete-book <id>', 'The ID of the book to delete.')
  .option(
    '--email <email>',
    'The email of the account to use. If both the email and password are provided, a personal access token will be created for the account.'
  )
  .option(
    '--password <password>',
    'The password of the account to use. If both the email and password are provided, a personal access token will be created for the account.'
  )
  .option(
    '--create-pat <expiration>',
    'The expiration date of the personal access token to create. If both the email and password are provided, a personal access token will be created for the account.'
  )
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
  if (userProvidedEmail && userProvidedPassword && opts.createPat) {
    const expiresAt = new Date(opts.createPat)

    const { error, personalAccessToken } = await createPATForAccount(
      userProvidedEmail,
      userProvidedPassword,
      expiresAt
    )

    if (error) {
      logger.error(error.message)
      return
    }

    activeToken = personalAccessToken
  }

  const userProvidedToken = opts.token || envVars.ACCOUNT_PAT

  if (!activeToken && !userProvidedToken) {
    logger.error('No personal access token was provided. Exiting...')
    return
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
    return
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
