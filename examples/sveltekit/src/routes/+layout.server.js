import { getNhostSessionFromCookie } from '$lib/nhost-auth-sveltekit';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ cookies }) {
	return {
		nhostSession: getNhostSessionFromCookie(cookies)
	};
}
