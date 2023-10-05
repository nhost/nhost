import { getNhost, NHOST_SESSION_KEY } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { cookies } = event
    const nhost = await getNhost(cookies)

    await nhost.auth.signOut()
    cookies.delete(NHOST_SESSION_KEY)

    throw redirect(303, '/sign-in')
  }
}
