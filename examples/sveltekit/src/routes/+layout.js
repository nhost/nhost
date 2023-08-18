import { getNhostLoadClient } from '$lib/nhost-auth-sveltekit.js';
import { redirect } from '@sveltejs/kit';

const unProtectedRoutes = ['/', '/sign-in', '/sign-up'];

export const load = async ({ data, depends, route }) => {
	depends('nhost:auth');

	const nhost = await getNhostLoadClient(data.nhostSession);
	const session = nhost.auth.getSession();

	if (!unProtectedRoutes.includes(route.id ?? '')) {
		if (!session) {
			throw redirect(303, '/');
		}
	}

	return {
		nhost: nhost,
		session: session
	};
};
