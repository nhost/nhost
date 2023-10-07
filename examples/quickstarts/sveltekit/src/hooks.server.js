import { manageAuthSession } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // You need to make sure as a developer to use this function
  // in order to:
  // 1- Refresh the accessToken when it expires
  // 2- handle oauth signIn via refreshToken in searchParams
  await manageAuthSession(event, () => {
    throw redirect(303, '/auth/sign-in')
  })

  return resolve(event)
}
