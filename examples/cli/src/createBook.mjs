import gql from 'graphql-tag'
import { client } from './nhostClient.mjs'

/**
 * Creates a book.
 *
 * @param {string} title - The title of the book to create
 * @param {string} writerId - The ID of the writer who wrote the book
 * @returns {Promise<{ data: { insert_books_one: { id: string; title: string } } | null; error: Error | null }>}
 */
export async function createBook(title, writerId) {
  return client.graphql.request(
    gql`
      mutation CreateBook($title: String!, $writerId: uuid!) {
        insert_books_one(object: { title: $title, writer_id: $writerId }) {
          id
          title
        }
      }
    `,
    { title, writerId }
  )
}
