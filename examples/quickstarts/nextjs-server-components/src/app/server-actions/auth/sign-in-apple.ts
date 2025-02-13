'use server'

import { getNhost } from '@utils/nhost'
import { redirect } from 'next/navigation'

export const signInWithApple = async () => {
  const nhost = await getNhost()

  const { providerUrl } = await nhost.auth.signIn({
    provider: 'apple'
  })

  if (providerUrl) {
    redirect(providerUrl)
  }
}
