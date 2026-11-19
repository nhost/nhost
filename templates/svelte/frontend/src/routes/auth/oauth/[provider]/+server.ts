import { error, redirect } from '@sveltejs/kit';
import { appOrigin } from '#lib/nhost/env.server.ts';
import { createNhostClient } from '#lib/nhost/server.ts';
import { signInDestination } from '#routes/signin/destination.ts';
import { recordSignInAttempt } from '#routes/signin/lastUsed.ts';
import {
  ACCOUNT_PICKER,
  configuredProviders,
  providerHref,
} from '../providers.ts';
import type { RequestHandler } from './$types';

/** Where a provider button goes before the provider. */
export const GET: RequestHandler = (event) => {
  const found = configuredProviders().find(
    ({ id }) => id === event.params.provider,
  );
  if (!found) {
    error(404, 'Not Found');
  }

  const destination = signInDestination(
    event.url.searchParams.get('next') ?? undefined,
  );
  const nhost = createNhostClient(event);
  const url = nhost.auth.signInProviderURL(found.id, {
    redirectTo: appOrigin() + destination,
    upstreamParams: ACCOUNT_PICKER,
  });

  recordSignInAttempt(event.cookies, providerHref(found.id));
  redirect(307, url, { external: [new URL(nhost.auth.baseURL).origin] });
};
