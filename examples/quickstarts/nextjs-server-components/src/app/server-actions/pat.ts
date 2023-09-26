'use server'

import { gql } from '@apollo/client'
import { getNhost } from '@utils/nhost'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export const createPAT = async (formData: FormData) => {
  const nhost = await getNhost()

  const name = formData.get('name') as string
  const expiration = formData.get('expiration') as string
  const expirationDate = new Date(expiration)

  await nhost.auth.createPAT(expirationDate, {
    name: name
  })

  redirect('/protected/pat')
}

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
