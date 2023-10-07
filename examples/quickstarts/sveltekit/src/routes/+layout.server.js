import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'
const unProtectedRoutes = [
  '/',
  '/auth/sign-in',
  '/auth/sign-in/email-password',
  '/auth/sign-in/magick-link',
  '/auth/sign-up'
]

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ cookies, route }) {
  const nhost = await getNhost(cookies)
  const session = nhost.auth.getSession()

  if (!unProtectedRoutes.includes(route.id ?? '')) {
    if (!session) {
      throw redirect(303, '/auth/sign-in')
    }
  }

  // pass the session to all pages
  return {
    user: session?.user
  }
}
