'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import { revalidatePath } from 'next/cache'

export const updateTodo = async (id: string, done: boolean) => {
  const nhost = await getNhost()

  await nhost.graphql.request(
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

  revalidatePath('/protected/todos')
}
