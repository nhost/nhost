import { manageAuthSession } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  await manageAuthSession(event, () => {
    throw redirect(303, '/auth/sign-in')
  })

  return resolve(event)
}
