import { error, redirect } from '@sveltejs/kit';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { signInHref } from '#routes/signin/destination.ts';
import { ACCOUNT_PICKER, configuredProviders } from '../../providers.ts';
import type { RequestHandler } from './$types';

const ACCOUNT_PATH = '/account';

/**
 * Where a Link account button goes: the same provider round trip as signing in,
 * with the session's access token as `connect`, which tells the auth service to
 * add the provider to that account rather than sign anyone in.
 */
export const GET: RequestHandler = (event) => {
  const found = configuredProviders().find(
    ({ id }) => id === event.params.provider,
  );
  if (!found) {
    error(404, 'Not Found');
  }

  const nhost = createNhostClient(event);
  const session = nhost.getUserSession();
  if (!session) {
    redirect(307, signInHref(ACCOUNT_PATH));
  }

  redirect(
    307,
    nhost.auth.signInProviderURL(found.id, {
      connect: session.accessToken,
      redirectTo: appOrigin() + ACCOUNT_PATH,
      upstreamParams: ACCOUNT_PICKER,
    }),
    { external: [new URL(nhost.auth.baseURL).origin] },
  );
};
