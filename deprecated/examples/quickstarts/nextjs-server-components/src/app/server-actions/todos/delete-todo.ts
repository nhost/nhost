'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import { revalidatePath } from 'next/cache'

export const deleteTodo = async (id: string) => {
  const nhost = await getNhost()

  await nhost.graphql.request(
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

  revalidatePath('/protected/todos')
}
