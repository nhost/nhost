import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ cookies }) => {
    const nhost = await getNhost(cookies)

    const { providerUrl } = await nhost.auth.signIn({ provider: 'google' })

    if (providerUrl) {
      throw redirect(307, providerUrl)
    }
  }
}
