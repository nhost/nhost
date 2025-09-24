'use server'

import { getNhost } from '@utils/nhost'
import { redirect } from 'next/navigation'

export const createPAT = async (formData: FormData) => {
  const nhost = await getNhost()

  const name = formData.get('name') as string
  const expiration = formData.get('expiration') as string
  const expirationDate = new Date(expiration)

  await nhost.auth.createPAT(expirationDate, { name })

  redirect('/protected/pat')
}
