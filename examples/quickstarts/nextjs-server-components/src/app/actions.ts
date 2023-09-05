'use server'

import { NHOST_SESSION_KEY, getNhost } from '@utils/nhost'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const signUp = async (formData: FormData) => {
  const nhost = await getNhost()

  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { session, error } = await nhost.auth.signUp({
    email,
    password,
    options: {
      displayName: `${firstName} ${lastName}`
    }
  })

  if (session) {
    cookies().set(NHOST_SESSION_KEY, JSON.stringify(session), {
      sameSite: 'strict'
    })

    redirect('/protected')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signIn = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { session, error } = await nhost.auth.signIn({ email, password })

  if (session) {
    cookies().set(NHOST_SESSION_KEY, JSON.stringify(session), {
      sameSite: 'strict'
    })

    redirect('/protected')
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}

export const signOut = async () => {
  const nhost = await getNhost()

  await nhost.auth.signOut()

  cookies().delete(NHOST_SESSION_KEY)

  redirect('/sign-in')
}
