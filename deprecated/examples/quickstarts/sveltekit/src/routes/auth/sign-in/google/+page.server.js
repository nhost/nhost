import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies }) => {
    const nhost = await getNhost(cookies)
    const { providerUrl } = await nhost.auth.signIn({
      provider: 'google',
      options: {
        redirectTo: new URL(request.url).origin
      }
    })

    if (providerUrl) {
      throw redirect(307, providerUrl)
    }
  }
}
