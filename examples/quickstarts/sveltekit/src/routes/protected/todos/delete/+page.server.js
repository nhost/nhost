import { getNhost } from '$lib/nhost'
import { gql } from '@apollo/client'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request, cookies } = event
    const nhost = await getNhost(cookies)

    const data = await request.formData()
    const id = data.get('id')

    const { error } = await nhost.graphql.request(
      gql`
        mutation deleteTodo($id: uuid!) {
          delete_todos_by_pk(id: $id) {
            id
          }
        }
      `,
      {
        id
      }
    )

    if (error) {
      return {
        error
      }
    }

    throw redirect(303, '/protected/todos')
  }
}
