'use server'

import { getNhost } from '@utils/nhost'
import { redirect } from 'next/navigation'

export const signInWithGoogle = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'google'
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}
