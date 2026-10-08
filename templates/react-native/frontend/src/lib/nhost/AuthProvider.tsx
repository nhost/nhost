import { createClient, type NhostClient } from '@nhost/nhost-js';
import type { Session } from '@nhost/nhost-js/auth';
import * as Linking from 'expo-linking';
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { nhostRegion, nhostSubdomain } from '@/lib/nhost/env';
import { redeemLinkToken } from '@/lib/nhost/linkToken';
import { startAuth } from '@/lib/nhost/startAuth';
import { AsyncSessionStorage } from '@/lib/nhost/storage';
import { watchSignIn } from '@/lib/nhost/watchSignIn';

type AuthValue = {
  nhost: NhostClient;
  session: Session | null;
  isLoading: boolean;
  // Why the latest link or provider callback did not sign the user in, in the
  // app's own words, or null when it did not fail.
  linkError: string | null;
  setLinkError: (message: string | null) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * The one Nhost client this app uses, and the session it currently holds.
 *
 * The client keeps the session in AsyncStorage through
 * `lib/nhost/storage.ts` and refreshes the access token itself, through the
 * default middleware, whenever a request goes out within 60s of expiry.
 * Nothing on a server is involved, so nothing else is rotating the refresh
 * token and there is no second writer to arbitrate with.
 *
 * The client is created once and never re-created: it owns the refresh timer
 * and the in-flight-refresh deduplication, so a second instance would be a
 * second rotator of a single-use token.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const storage = useRef(new AsyncSessionStorage()).current;

  const nhost = useMemo(
    () =>
      createClient({
        subdomain: nhostSubdomain(),
        region: nhostRegion(),
        storage,
      }),
    [storage],
  );

  const [session, setSession] = useState<Session | null>(null);

  // True until the stored session has been read off disk and the link the
  // app was opened with has been redeemed, and again while a link that
  // arrives later is. Auth emails and the OAuth callback come back as those
  // links, so until then nobody knows who the user is about to be.
  const [isLoading, setIsLoading] = useState(true);

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Someone signing in has moved on from whatever link failed before, and
    // the notice would otherwise follow them through the app.
    const signIns = watchSignIn(() => setLinkError(null));

    const show = (next: Session | null): void => {
      signIns.seen(next);
      setSession(next);
    };

    const unsubscribe = nhost.sessionStorage.onChange(show);

    const stop = startAuth({
      hydrate: async () => {
        await storage.hydrate();
        signIns.hydrated(nhost.getUserSession());
      },
      initialURL: () => Linking.getInitialURL(),
      listen: (onURL) => {
        const subscription = Linking.addEventListener('url', ({ url }) =>
          onURL(url),
        );
        return () => subscription.remove();
      },
      redeem: (url) => redeemLinkToken(nhost, url),
      onLoading: (loading) => {
        // Hydrating writes nothing through the client, so `onChange` does
        // not hear it.
        show(nhost.getUserSession());
        setIsLoading(loading);
      },
      onLinkError: setLinkError,
    });

    return () => {
      stop();
      unsubscribe();
    };
  }, [nhost, storage]);

  const value = useMemo<AuthValue>(
    () => ({ nhost, session, isLoading, linkError, setLinkError }),
    [nhost, session, isLoading, linkError],
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
