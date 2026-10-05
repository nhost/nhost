# React Native (Expo + Expo Router)

Source: the React Native tutorial, parts 2 and 4.
- https://docs.nhost.io/getting-started/tutorials/reactnative/2-protected-routes
- https://docs.nhost.io/getting-started/tutorials/reactnative/4-graphql-operations
- Minimal version: https://docs.nhost.io/getting-started/quickstart/reactnative
- Sign in with Apple: https://docs.nhost.io/getting-started/tutorials/reactnative/6-sign-in-with-apple
- Full code: `examples/tutorials/nhost-reactnative-tutorial` in the nhost/nhost repo

## Install

```bash
npx expo install @nhost/nhost-js @react-native-async-storage/async-storage@~2 expo-router@~6 expo-constants@~18
```

For a new app the tutorial sets `"main": "expo-router/entry"` in `package.json`.

## Config (`app.json` → `expo.extra`)

```json
"extra": {
  "NHOST_REGION": "<region>",
  "NHOST_SUBDOMAIN": "<subdomain>"
}
```

Read with `Constants.expoConfig?.extra?.["NHOST_SUBDOMAIN"]` from `expo-constants`, falling back to `"local"`.

**Local backend from a device or emulator:** `local` URLs resolve to `127.0.0.1`. For a phone, VM or mobile emulator the docs recommend starting the CLI with the host machine's LAN IP as the local subdomain (`nhost --local-subdomain 192-168-1-108 up`, a global flag, or env `NHOST_LOCAL_SUBDOMAIN`; dashes instead of dots) and using that value as `subdomain` with `region: "local"`. See https://docs.nhost.io/platform/cli/subdomain. Ask the user for their IP; do not guess.

## Session storage (required)

React Native has no browser `localStorage`, so always pass `storage` to `createClient`. The tutorial writes an AsyncStorage adapter implementing `SessionStorageBackend` (`app/lib/nhost/AsyncStorage.tsx`). Its shape:

```tsx
import { DEFAULT_SESSION_KEY, type SessionStorageBackend, type StoredSession } from "@nhost/nhost-js/session";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default class NhostAsyncStorage implements SessionStorageBackend {
  private key: string;
  private cache: StoredSession | null = null;

  constructor(key: string = DEFAULT_SESSION_KEY) {
    this.key = key;
    AsyncStorage.getItem(this.key)
      .then((value) => { if (value) this.cache = JSON.parse(value) as StoredSession; })
      .catch((error) => console.warn("Error loading from AsyncStorage:", error));
  }
  get(): StoredSession | null { return this.cache; }
  set(value: StoredSession): void {
    this.cache = value;
    void AsyncStorage.setItem(this.key, JSON.stringify(value)).catch(console.warn);
  }
  remove(): void {
    this.cache = null;
    void AsyncStorage.removeItem(this.key).catch(console.warn);
  }
}
```

`get()` must be synchronous, so the adapter caches in memory and loads from AsyncStorage in the background. Copy the tutorial's full version (it adds JSON parse error handling).

## Auth provider (`app/lib/nhost/AuthProvider.tsx`)

Same context shape as the React web version (`user`, `session`, `isAuthenticated`, `isLoading`, `nhost`), with these differences:

```tsx
const nhost = useMemo(() => {
  const subdomain = (Constants.expoConfig?.extra?.["NHOST_SUBDOMAIN"] as string) || "local";
  const region = (Constants.expoConfig?.extra?.["NHOST_REGION"] as string) || "local";
  return createClient({ subdomain, region, storage: new NhostAsyncStorage() });
}, []);

useEffect(() => {
  setIsLoading(true);
  const initializeSession = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 100)); // let AsyncStorage load
      const current = nhost.getUserSession();
      setUser(current?.user || null);
      setSession(current);
      setIsAuthenticated(!!current);
    } finally {
      setIsLoading(false);
    }
  };
  void initializeSession();
  const unsubscribe = nhost.sessionStorage.onChange((current) => {
    setUser(current?.user || null);
    setSession(current);
    setIsAuthenticated(!!current);
  });
  return () => unsubscribe();
}, [nhost]);
```

No `visibilitychange` / `focus` listeners (browser-only). Wrap the root in `app/_layout.tsx`: `<AuthProvider><Stack>...</Stack></AuthProvider>`.

## Protected screens

```tsx
export default function ProtectedScreen({ children, redirectTo = "/signin" }) {
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(redirectTo);
  }, [isAuthenticated, isLoading, redirectTo]);
  if (isLoading) return <ActivityIndicator size="large" />;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

Wrap each protected screen's content: `<ProtectedScreen>...</ProtectedScreen>`.

## GraphQL

Same as React: `const { nhost } = useAuth();` then `nhost.graphql.request({ query, variables })` in `try/catch`, reading `response.body.data`.

Sign out: `await nhost.auth.signOut({ refreshToken: session.refreshToken })`. Sign-in / sign-up: `auth` skill, or https://docs.nhost.io/getting-started/tutorials/reactnative/3-user-authentication
