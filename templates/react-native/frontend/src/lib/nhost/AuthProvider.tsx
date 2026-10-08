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
import { AsyncSessionStorage } from '@/lib/nhost/storage';

type AuthValue = {
  nhost: NhostClient;
  session: Session | null;
  isLoading: boolean;
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

  // Starts true so nothing renders a signed-out view before the stored
  // session has been read off disk. Reading it is asynchronous here, unlike
  // the web templates' localStorage, so this is doing real work.
  const [isLoading, setIsLoading] = useState(true);

  // The deep link this app was opened with, and every one that arrives while
  // it is running. Auth emails and the OAuth callback come back this way.
  const url = Linking.useURL();

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = nhost.sessionStorage.onChange((next) =>
      setSession(next),
    );

    const start = async (): Promise<void> => {
      await storage.hydrate();

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
  }, [nhost, storage]);

  // Separate from the hydrate effect because this one runs again for every
  // link that arrives, and hydrating twice would undo a session the first
  // link had just stored.
  useEffect(() => {
    if (!url) {
      return;
    }

    void redeemLinkToken(nhost, url);
  }, [nhost, url]);

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
