import { program } from 'commander'
import dotenv from 'dotenv'
import { createBook } from './createBook.mjs'
import { createPATForServiceAccount } from './createPATForServiceAccount.mjs'
import { deleteBook } from './deleteBook.mjs'
import { logger } from './logger.mjs'
import { client } from './nhostClient.mjs'

dotenv.config()

program
  .name('nhost-bookstore-cli')
  .description('This CLI tool shows how to use the Nhost JS SDK and personal access tokens.')
program
  .option('--create-book <title>')
  .option('--delete-book <id>')
  .option('--create-pat <expiration>')
program.parse()

async function main() {
  const opts = program.opts()

  if (!opts.createBook && !opts.deleteBook && !opts.createPat) {
    logger.info('No command was provided. Exiting...')
    return
  }

  const { error: patError, personalAccessToken } = await createPATForServiceAccount()

  if (patError) {
    logger.error(patError.message)
    return
  }

  logger.info(`Using PAT: ${personalAccessToken}`)
  logger.debug('Signing in with the personal access token...')

  const { error: signInError, session } = await client.auth.signInPAT(personalAccessToken)

  if (signInError) {
    logger.error(signInError.message)
    return
  }

  logger.info(
    `Successfully signed in as "${session.user.displayName}" using the personal access token.`
  )

  // Set the access token for the GraphQL client
  client.graphql.setAccessToken(session.accessToken)

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

  if (opts.createPat) {
    const { personalAccessToken, error } = await client.auth.createPAT(new Date(opts.createPat), {
      name: 'via-example-cli'
    })

    if (error) {
      logger.error(error.message)
      return
    }

    logger.info(`Successfully create a new personal access token: ${personalAccessToken}`)
  }
}

main()
