import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'
const unProtectedRoutes = ['/', '/sign-in', '/sign-up']

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ cookies, route }) {
  const nhost = await getNhost(cookies)
  const session = nhost.auth.getSession()

  if (!unProtectedRoutes.includes(route.id ?? '')) {
    if (!session) {
      throw redirect(303, '/sign-in')
    }
  }

  // pass the session to all pages
  return {
    session
  }
}
