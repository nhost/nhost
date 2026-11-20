import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ACCOUNT_PICKER,
  configuredProviders,
} from '@/app/auth/oauth/providers';
import { signInHref } from '@/app/signin/destination';
import NotFound from '@/components/NotFound';
import { nhost } from '@/lib/nhost/client';
import { appOrigin } from '@/lib/nhost/env';

const ACCOUNT_PATH = '/account';

/**
 * Where a Link account button goes: the same provider round trip as signing in,
 * with the session's access token as `connect`, which tells the auth service to
 * add the provider to that account rather than sign anyone in.
 */
export default function ProviderConnect() {
  const { provider } = useParams();
  const navigate = useNavigate();
  const found = configuredProviders().find(({ id }) => id === provider);

  const sent = useRef(false);
  useEffect(() => {
    if (!found || sent.current) {
      return;
    }
    sent.current = true;

    // Refreshed first, so the token the auth service reads has not expired.
    void nhost.refreshSession(60).then((session) => {
      if (!session) {
        navigate(signInHref(ACCOUNT_PATH), { replace: true });
        return;
      }

      window.location.replace(
        nhost.auth.signInProviderURL(found.id, {
          connect: session.accessToken,
          redirectTo: appOrigin() + ACCOUNT_PATH,
          upstreamParams: ACCOUNT_PICKER,
        }),
      );
    });
  }, [found, navigate]);

  return found ? null : <NotFound />;
}
