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
import { hasLinkToken, redeemLinkToken } from '@/lib/nhost/linkToken';
import { watchSession } from '@/lib/nhost/watchSession';

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
 * middleware, whenever a request goes out within 60s of expiry. There is no
 * timer: a tab that sends nothing refreshes nothing. Nothing on a server is
 * involved. The only other writers are this app's other tabs, and the SDK
 * serialises refreshes with `navigator.locks`, which every client on the
 * origin shares, so two tabs do not spend the same single-use refresh token.
 *
 * The client is created once and never re-created because the session here
 * follows it: `sessionStorage.onChange` hears only writes made through this
 * instance, so a sign-in or sign-out through a second client in this tab
 * would leave the app rendering the old visitor.
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

  // Read during the first render, not after it: `localStorage` is
  // synchronous, so an ordinary page load never shows a signed-in visitor as
  // signed out, not even for one frame.
  const [session, setSession] = useState<Session | null>(() =>
    nhost.getUserSession(),
  );

  // True only while a token on the URL is being redeemed. Until then the
  // stored session says nothing about who the visitor is about to be, so
  // anything that renders differently for a signed-out visitor has to wait,
  // or someone who is being signed in is offered "Sign in" meanwhile.
  const [isLoading, setIsLoading] = useState(hasLinkToken);

  useEffect(() => {
    let cancelled = false;

    // Started before the token is redeemed, so the session that redemption
    // stores is not missed.
    const unwatch = watchSession(nhost, setSession);

    const start = async (): Promise<void> => {
      // An arrival from an auth email or an OAuth callback carries the
      // session on the URL, and it has to be exchanged before anyone can say
      // whether the visitor is signed in.
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
      unwatch();
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
