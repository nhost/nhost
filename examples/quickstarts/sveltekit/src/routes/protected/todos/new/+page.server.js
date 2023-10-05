import { getNhost } from '$lib/nhost'
import { gql } from '@apollo/client'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request, cookies } = event

    const nhost = await getNhost(cookies)
    const data = await request.formData()

    const title = String(data.get('title'))
    const file = /** @type {File} */ (data.get('file'))

    let payload = {}
    payload.title = title

    if (file) {
      const { fileMetadata, error } = await nhost.storage.upload({
        formData: data
      })

      if (error) {
        console.log({ error })
      }

      payload.file_id = fileMetadata?.processedFiles[0]?.id || null
    }

    const response = await nhost.graphql.request(
      gql`
        mutation insertTodo($title: String!, $file_id: uuid) {
          insert_todos_one(object: { title: $title, file_id: $file_id }) {
            id
          }
        }
      `,
      payload
    )

    if (response.error) {
      return {
        error: response.error
      }
    }

    // throw redirect(303, '/protected/todos')
  }
}
