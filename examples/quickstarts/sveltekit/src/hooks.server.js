import { getNhost, NHOST_SESSION_KEY } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  // The purpose of this hook is to check if the accessToken has expired
  // If the accessToken has expires, then we get a new one with the refreshToken
  // already stored in the session cookie

  const { cookies } = event

  const nhost = await getNhost(cookies)
  const session = nhost.auth.getSession()

  const currentTime = Math.floor(Date.now() / 1000)
  const tokenExpirationTime = nhost.auth.getDecodedAccessToken()?.exp
  const accessTokenExpired = session && tokenExpirationTime && currentTime > tokenExpirationTime

  if (accessTokenExpired) {
    const { session: newSession, error } = await nhost.auth.refreshSession()

    if (error) {
      throw redirect(303, '/auth/sign-in')
    }

    cookies.set(NHOST_SESSION_KEY, btoa(JSON.stringify(newSession)), { path: '/' })
  }

  const response = await resolve(event)

  return response
}
