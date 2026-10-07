import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { nhostRegion, nhostSubdomain } from '@/lib/nhost/env';
import { redeemLinkToken } from '@/lib/nhost/linkToken';

type AuthValue = {
  nhost: NhostClient;
  session: Session | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The one Nhost client this app uses, and the session it currently holds.
 *
 * `createClient` is the browser client: it keeps the session in
 * `localStorage` and refreshes the access token itself, through the default
 * middleware, whenever a request goes out within 60s of expiry. That is the
 * whole session design here. Nothing on a server is involved, so nothing else
 * is rotating the refresh token and there is no second writer to arbitrate
 * with.
 *
 * The client is created once and never re-created: it owns the refresh timer
 * and the in-flight-refresh deduplication, so a second instance would be a
 * second rotator of a single-use token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const nhost = useMemo(
    () =>
      createClient({
        subdomain: nhostSubdomain(),
        region: nhostRegion(),
      }),
    [],
  );

  const [session, setSession] = useState<Session | null>(null);

  // Starts true so nothing renders a signed-out view before the stored
  // session has been read. Without it a protected route would bounce a
  // signed-in visitor to sign-in for one frame on every full page load.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Fires for this tab's own writes and for other tabs', so signing out in
    // one tab signs out the rest. Subscribed before the token is redeemed, so
    // the session that redemption stores is not missed.
    const unsubscribe = nhost.sessionStorage.onChange((next) =>
      setSession(next),
    );

    const start = async (): Promise<void> => {
      // An arrival from an auth email or an OAuth callback carries the
      // session on the URL, so it has to be taken before the first read or
      // the visitor renders as signed out and the token is lost.
      await redeemLinkToken(nhost);

      if (cancelled) {
        return;
      }

      setSession(nhost.getUserSession());
      setIsLoading(false);
    };

    void start();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [nhost]);

  const value = useMemo<AuthValue>(
    () => ({ nhost, session, isLoading }),
    [nhost, session, isLoading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  return value;
}
