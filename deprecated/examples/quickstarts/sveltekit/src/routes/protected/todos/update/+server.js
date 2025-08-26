import { getNhost } from '$lib/nhost'
import { json } from '@sveltejs/kit'
import gql from 'graphql-tag'

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
