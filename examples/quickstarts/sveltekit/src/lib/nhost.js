import { env } from '$env/dynamic/public';
import { NhostClient } from '@nhost/nhost-js';
import { redirect } from '@sveltejs/kit';
import { waitFor } from 'xstate/lib/waitFor';

export const NHOST_SESSION_KEY = 'nhostSession';

/** @param {import('@sveltejs/kit').Cookies} cookies */
export const getNhost = async (cookies) => {

  /** @type {import('@nhost/nhost-js').NhostClient} */
	const nhost = new NhostClient({
    subdomain: env.PUBLIC_NHOST_SUBDOMAIN || 'local',
    region: env.PUBLIC_NHOST_REGION,
    clientStorageType: 'cookie',
		start: false
  })

  const sessionCookieValue = cookies.get(NHOST_SESSION_KEY) || ''
	
	/** @type {import('@nhost/nhost-js').NhostSession} */
  const initialSession = JSON.parse(atob(sessionCookieValue) || 'null')
  
  nhost.auth.client.start({ initialSession })

	/** @type {import('@nhost/nhost-js').NhostSession} */
	if (nhost.auth.client.interpreter) {
		await waitFor(nhost.auth.client.interpreter, (state) => !state.hasTag('loading'))
	}

  return nhost
}

/**
 * @param {import('@sveltejs/kit').RequestEvent} event
 * @param {*} onError
 */
export const manageAuthSession = async (
	event,
	onError
) => {
	const nhost = await getNhost(event.cookies)
  const session = nhost.auth.getSession()

  const refreshToken = event.url.searchParams.get('refreshToken') || undefined

  const currentTime = Math.floor(Date.now() / 1000)
  const tokenExpirationTime = nhost.auth.getDecodedAccessToken()?.exp
  const accessTokenExpired = session && tokenExpirationTime && currentTime > tokenExpirationTime

  if (accessTokenExpired || refreshToken) {
    const { session: newSession, error } = await nhost.auth.refreshSession(refreshToken)

    if (error) {
      // delete session cookie when the refreshToken has expired
      event.cookies.delete(NHOST_SESSION_KEY, { path: '/' })
      return onError?.(error)
    }

    event.cookies.set(NHOST_SESSION_KEY, btoa(JSON.stringify(newSession)), { path: '/' })
		
		if (refreshToken) {
			event.url.searchParams.delete('refreshToken')
			throw redirect(303, event.url.pathname)
		}
  }
}