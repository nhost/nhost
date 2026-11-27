import { redirect } from '@sveltejs/kit';
import { getVerifiedUser } from '#lib/nhost/server.ts';
import { signInHref } from '#routes/signin/destination.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // The hook only reads the session cookie, which anyone can write, so it
  // redirects the signed-out but proves nothing.
  const user = await getVerifiedUser();

  if (!user) {
    redirect(307, signInHref('/account'));
  }

  return { user };
};
