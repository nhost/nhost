'use server'

import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const signIn = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { session, error } = await nhost.auth.signIn({ email, password })

  const cookieStore = await cookies()

  if (session) {
    cookieStore.set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
    redirect('/protected/todos')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}
