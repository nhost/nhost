'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import { revalidatePath } from 'next/cache'

export const deletePAT = async (id: string) => {
  const nhost = await getNhost()

  await nhost.graphql.request(
    gql`
      mutation deletePersonalAccessToken($id: uuid!) {
        deleteAuthRefreshToken(id: $id) {
          id
        }
      }
    `,
    {
      id
    }
  )

  revalidatePath('/protected/pat')
}
