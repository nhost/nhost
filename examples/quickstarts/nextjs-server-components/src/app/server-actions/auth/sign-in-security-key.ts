'use server'

import { getNhost } from '@utils/nhost'

export const signInWithSecurityKey = async (formData: FormData) => {
  const nhost = await getNhost()

  const email = formData.get('email') as string

  const { error, session } = await nhost.auth.signIn({
    email: email,
    securityKey: true
  })

  if (!session) {
    return {
      error: error?.message
    }
  }

  if (error) {
    return {
      error: error?.message
    }
  }
}
