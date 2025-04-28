'use server'

import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const signOut = async () => {
  const nhost = await getNhost()

  await nhost.auth.signOut()

  const cookieStore = await cookies()
  cookieStore.delete(NHOST_SESSION_KEY)

  redirect('/auth/sign-in')
}
