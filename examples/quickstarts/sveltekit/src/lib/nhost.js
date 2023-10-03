import { env } from '$env/dynamic/public';
import { NhostClient } from '@nhost/nhost-js';
import { waitFor } from 'xstate/lib/waitFor';

export const NHOST_SESSION_KEY = 'nhostSession';

/** @param {import('@sveltejs/kit').Cookies} cookies */
export const getNhost = async (cookies) => {
	const nhost = new NhostClient({
    subdomain: env.PUBLIC_NHOST_SUBDOMAIN || 'local',
		region: env.PUBLIC_NHOST_REGION,
		start: false
  })

  const sessionCookieValue = cookies.get(NHOST_SESSION_KEY) || ''
	
	/** @type {import('@nhost/nhost-js').NhostSession} */
  const initialSession = JSON.parse(atob(sessionCookieValue) || 'null')

	// TODO handle accessToken expired

  nhost.auth.client.start({ initialSession })

	/** @type {import('@nhost/nhost-js').NhostSession} */
	if (nhost.auth.client.interpreter) {
		await waitFor(nhost.auth.client.interpreter, (state) => !state.hasTag('loading'))
	}

  return nhost
}
