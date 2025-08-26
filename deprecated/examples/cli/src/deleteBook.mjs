import gql from 'graphql-tag'
import { client } from './nhostClient.mjs'

/**
 * Deletes a book.
 *
 * @param {string} id - The ID of the book to delete
 * @returns {Promise<{ data: { delete_books_by_pk: { id: string; title: string } | null } | null; error: Error | null }>}
 */
export async function deleteBook(id) {
  return client.graphql.request(
    gql`
      mutation DeleteBook($id: uuid!) {
        delete_books_by_pk(id: $id) {
          id
          title
        }
      }
    `,
    { id }
  )
}
