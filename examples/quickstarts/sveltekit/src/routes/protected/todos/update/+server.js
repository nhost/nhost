import { getNhost } from '$lib/nhost'
import { gql } from '@apollo/client'
import { json } from '@sveltejs/kit'

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
  const nhost = await getNhost(cookies)
  const { id, done } = await request.json()

  const { data } = await nhost.graphql.request(
    gql`
      mutation updateTodo($id: uuid!, $done: Boolean!) {
        update_todos_by_pk(pk_columns: { id: $id }, _set: { done: $done }) {
          id
          title
          done
        }
      }
    `,
    {
      id,
      done
    }
  )

  return json(data)
}
