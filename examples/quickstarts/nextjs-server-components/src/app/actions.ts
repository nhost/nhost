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
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), {
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
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), {
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

export const signInWithPAT = async (formData: FormData) => {
  const nhost = await getNhost()

  const pat = formData.get('pat') as string

  const { session, error } = await nhost.auth.signInPAT(pat)

  if (session) {
    cookies().set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), {
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

export const signInWithGoogle = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'google',
    options: {
      redirectTo: `/oauth`
    }
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}

export const signInWithApple = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'apple',
    options: {
      redirectTo: `/oauth`
    }
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}

export const signInWithSecurityKey = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string

  const { error, session } = await nhost.auth.signIn({
    email: email,
    securityKey: true
  })

  if (!session) {
    // Something unexpected happened
    console.log(error)
    return {
      error: error?.message
    }
  }

  // Something unexpected happened, for instance, the user canceled the process
  if (error) {
    console.log(error)
    return {
      error: error?.message
    }
  }
}

export const signOut = async () => {
  const nhost = await getNhost()

  await nhost.auth.signOut()

  cookies().delete(NHOST_SESSION_KEY)

  redirect('/auth/sign-in')
}
