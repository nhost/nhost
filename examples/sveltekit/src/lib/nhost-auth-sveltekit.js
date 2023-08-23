import { invalidate } from '$app/navigation';
import { env } from '$env/dynamic/public';
import { NhostClient } from '@nhost/nhost-js';
import Cookies from 'js-cookie';

export const NHOST_SESSION_KEY = 'nhostSession';
const isBrowser = typeof window !== 'undefined';

/** @type {import('@nhost/nhost-js').NhostClient | null} */
let nhost;

/** @param {import('@nhost/nhost-js').NhostSession | null} session */
export const setNhostSessionInCookie = (session) => {
	if (!session) {
		Cookies.remove(NHOST_SESSION_KEY);
		return;
	}

	const expires = new Date();

	// * Expire the cookie 60 seconds before the token expires
	expires.setSeconds(expires.getSeconds() + session.accessTokenExpiresIn - 60);

	Cookies.set(NHOST_SESSION_KEY, JSON.stringify(session), {
		sameSite: 'strict',
		expires
	});
};

/** @param {import('@sveltejs/kit').Cookies} cookies */
export const getNhostSessionFromCookie = (cookies) => {
	const nhostSessionCookie = cookies.get(NHOST_SESSION_KEY);
	return nhostSessionCookie ? JSON.parse(nhostSessionCookie) : null;
};

/** @param {import('@nhost/nhost-js').NhostSession} session */
export const getNhostLoadClient = async (session) => {
	if (isBrowser && nhost) {
		return nhost;
	}

	nhost = new NhostClient({
		subdomain: env.PUBLIC_NHOST_SUBDOMAIN || 'local',
		region: env.PUBLIC_NHOST_REGION,
		start: false
	});

	if (isBrowser) {
		nhost.auth.onAuthStateChanged((_, session) => {
			setNhostSessionInCookie(session);
			invalidate('nhost:auth');
		});

		nhost.auth.onTokenChanged((session) => {
			setNhostSessionInCookie(session);
		});
	}

	nhost.auth.client.start({ initialSession: session });

	return nhost;
};
