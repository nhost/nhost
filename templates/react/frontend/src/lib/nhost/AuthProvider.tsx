import type { StoredSession } from '@nhost/nhost-js/session';
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
import { useLocation } from 'react-router';
import { nhost } from './client';
import { type SessionWatcher, watchSession } from './watchSession';

type AuthState = {
  session: StoredSession | null;
  // Bumped whenever the guard has to look at the session again.
  recheck: number;
  // Bumped whenever pages have to load their data again.
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

/** The session as this tab knows it, for whatever shows who is signed in. */
export const useSession = (): StoredSession | null => useAuth().session;

/** Holds the session for the app and follows it for as long as it is open. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(() => nhost.getUserSession());
  const [recheck, setRecheck] = useState(0);
  const [load, setLoad] = useState(0);

  const bumpRecheck = useCallback(() => setRecheck((n) => n + 1), []);
  const refresh = useCallback(() => {
    setLoad((n) => n + 1);
    setRecheck((n) => n + 1);
  }, []);

  const watcher = useRef<SessionWatcher | null>(null);
  useEffect(() => {
    const watching = watchSession({
      onSession: setSession,
      onRecheck: bumpRecheck,
      onRefresh: refresh,
    });
    watcher.current = watching;
    setSession(nhost.getUserSession());

    return () => {
      watching.stop();
      watcher.current = null;
    };
  }, [bumpRecheck, refresh]);

  // Startup has just checked the first page, so only later navigations check.
  const { key } = useLocation();
  const firstKey = useRef(key);
  useEffect(() => {
    if (key !== firstKey.current) {
      void watcher.current?.checkRevoked();
    }
  }, [key]);

  const value = useMemo(
    () => ({ session, recheck, load, refresh }),
    [session, recheck, load, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
