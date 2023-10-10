import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'
const publicRoutes = [
  '/',
  '/auth/sign-in',
  '/auth/sign-in/email-password',
  '/auth/sign-in/magick-link',
  '/auth/sign-in/webauthn',
  '/auth/sign-in/google',
  '/auth/sign-in/pat',
  '/auth/sign-up',
  '/auth/sign-up/email-password',
  '/auth/sign-up/magick-link',
  '/auth/sign-up/webauthn'
]

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ cookies, route }) {
  const nhost = await getNhost(cookies)
  const session = nhost.auth.getSession()

  if (!publicRoutes.includes(route.id ?? '') && !session) {
    throw redirect(303, '/auth/sign-in')
  }

  return {
    user: session?.user
  }
}
