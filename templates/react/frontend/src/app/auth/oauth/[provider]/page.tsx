import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router';
import {
  ACCOUNT_PICKER,
  configuredProviders,
  providerHref,
} from '@/app/auth/oauth/providers';
import { signInDestination } from '@/app/signin/destination';
import { recordSignInAttempt } from '@/app/signin/lastUsed';
import NotFound from '@/components/NotFound';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';

/** Where a provider button goes before the provider. */
export default function ProviderRedirect() {
  const { provider } = useParams();
  const [searchParams] = useSearchParams();
  const found = configuredProviders().find(({ id }) => id === provider);
  const next = searchParams.get('next') ?? undefined;

  // Once, though StrictMode runs effects twice. `replace` keeps this page out
  // of the history, so Back from the provider skips it.
  const sent = useRef(false);
  useEffect(() => {
    if (!found || sent.current) {
      return;
    }
    sent.current = true;

    recordSignInAttempt(providerHref(found.id));
    window.location.replace(
      nhost.auth.signInProviderURL(found.id, {
        redirectTo: appOrigin() + signInDestination(next),
        upstreamParams: ACCOUNT_PICKER,
      }),
    );
  }, [found, next]);

  return found ? null : <NotFound />;
}
