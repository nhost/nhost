import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'
import gql from 'graphql-tag'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request, cookies } = event

    const nhost = await getNhost(cookies)
    const data = await request.formData()

    const title = /** @type {string} */ data.get('title')
    const file = /** @type {File | null} */ (data.get('file'))

    let payload = {}
    payload.title = title

    if (file && file.size > 0) {
      const { fileMetadata, error: storageUploadError } = await nhost.storage.upload({
        formData: data
      })

      if (storageUploadError) {
        return {
          error: storageUploadError.message
        }
      }

      payload.file_id = fileMetadata?.processedFiles[0]?.id || null
    }

    const { error } = await nhost.graphql.request(
      gql`
        mutation insertTodo($title: String!, $file_id: uuid) {
          insert_todos_one(object: { title: $title, file_id: $file_id }) {
            id
          }
        }
      `,
      payload
    )

    if (error) {
      return {
        error
      }
    }

    throw redirect(303, '/protected/todos')
  }
}
