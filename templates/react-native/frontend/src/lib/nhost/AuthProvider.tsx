import type { StoredSession } from '@nhost/nhost-js/session';
import { router, usePathname } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearch } from '@/lib/useSearch';
import { nhost } from './client';
import { type SessionWatcher, watchSession } from './watchSession';

type AuthState = {
  session: StoredSession | null;
  // Bumped whenever the guard has to look at the session again.
  recheck: number;
  // Bumped whenever screens have to load their data again.
  load: number;
  refresh: VoidFunction;
};

const AuthContext = createContext<AuthState>({
  session: null,
  recheck: 0,
  load: 0,
  refresh: () => undefined,
});

export const useAuth = (): AuthState => useContext(AuthContext);

/** The session as the app knows it, for whatever shows who is signed in. */
export const useSession = (): StoredSession | null => useAuth().session;

/** Holds the session for the app and follows it for as long as it runs. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => nhost.getUserSession());
  const [recheck, setRecheck] = useState(0);
  const [load, setLoad] = useState(0);

  const refresh = useCallback(() => {
    setLoad((n) => n + 1);
    setRecheck((n) => n + 1);
  }, []);

  const pathname = usePathname();
  const href = `${pathname}${useSearch()}`;
  const here = useRef(href);
  useEffect(() => {
    here.current = href;
  }, [href]);

  // Screens under the current one may show the account, and the guard only
  // runs on the focused one, so the stack goes first. The screen opened again
  // in its place runs the guard.
  const onRevoked = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace(here.current);
  }, []);

  const watcher = useRef<SessionWatcher | null>(null);
  useEffect(() => {
    const watching = watchSession({
      onSession: setSession,
      onRevoked,
      onRefresh: refresh,
    });
    watcher.current = watching;
    setSession(nhost.getUserSession());

    return () => {
      watching.stop();
      watcher.current = null;
    };
  }, [onRevoked, refresh]);

  // Startup has just checked the first screen, so only later navigations
  // check.
  const lastPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== lastPathname.current) {
      lastPathname.current = pathname;
      void watcher.current?.checkRevoked();
    }
  }, [pathname]);

  const value = useMemo(
    () => ({ session, recheck, load, refresh }),
    [session, recheck, load, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
