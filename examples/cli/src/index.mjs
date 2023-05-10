import { program } from 'commander'
import dotenv from 'dotenv'
import gql from 'graphql-tag'
import { createPATForServiceAccount } from './createPATForServiceAccount.mjs'
import { logger } from './logger.mjs'
import { client } from './nhostClient.mjs'

dotenv.config()

program
  .name('nhost-bookstore-cli')
  .description('This CLI tool shows how to use the Nhost JS SDK and personal access tokens.')
program.option('--create-book <title>').option('--delete-book <id>')
program.parse()

async function main() {
  const opts = program.opts()

  if (!opts.createBook && !opts.deleteBook) {
    logger.info('No command was provided. Exiting...')
    return
  }

  const { error: patError, personalAccessToken } = await createPATForServiceAccount()

  logger.info(`Using PAT: ${personalAccessToken}`)

  if (patError) {
    logger.error(patError.message)

    return
  }

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
    const { data, error } = await client.graphql.request(
      gql`
        mutation CreateBook($title: String!, $writerId: uuid!) {
          insert_books_one(object: { title: $title, writer_id: $writerId }) {
            id
            title
          }
        }
      `,
      { title: opts.createBook, writerId: session.user.id }
    )

    if (error) {
      logger.error(Array.isArray(error) ? error[0].message : error.message)
      return
    }

    logger.info(
      `Successfully created book "${data.insert_books_one.title}" with ID "${data.insert_books_one.id}".`
    )

    return
  }

  if (opts.deleteBook) {
    const { data, error } = await client.graphql.request(
      gql`
        mutation DeleteBook($id: uuid!) {
          delete_books_by_pk(id: $id) {
            id
            title
          }
        }
      `,
      { id: opts.deleteBook }
    )

    if (error) {
      logger.error(Array.isArray(error) ? error[0].message : error.message)
      return
    }

    if (!data.delete_books_by_pk) {
      logger.warn(`No book with ID "${opts.deleteBook}" was found.`)
      return
    }

    logger.info(`Successfully deleted the book with ID "${opts.deleteBook}".`)
  }
}

main()
