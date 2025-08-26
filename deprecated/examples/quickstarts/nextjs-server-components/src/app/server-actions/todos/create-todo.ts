'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import { redirect } from 'next/navigation'

export const createTodo = async (formData: FormData) => {
  const nhost = await getNhost()

  const title = formData.get('title') as string
  const file = formData.get('file') as File

  let payload: {
    title: string
    file_id?: string
  } = {
    title
  }

  if (file) {
    const { fileMetadata } = await nhost.storage.upload({
      formData
    })

    payload.file_id = fileMetadata?.processedFiles[0]?.id
  }

  await nhost.graphql.request(
    gql`
      mutation insertTodo($title: String!, $file_id: uuid) {
        insert_todos_one(object: { title: $title, file_id: $file_id }) {
          id
        }
      }
    `,
    payload
  )

  redirect('/protected/todos')
}
