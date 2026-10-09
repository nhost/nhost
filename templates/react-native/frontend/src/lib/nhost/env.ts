import * as Linking from 'expo-linking';

const LOCAL = 'local';

/**
 * Backend coordinates for the client this app creates.
 *
 * A subdomain and a region are not secrets: they appear in every request URL
 * the app makes. There is nothing else to hide here either, because everything
 * this app is built with ships inside the bundle on the user's device, which
 * anyone can unpack. Never put a secret in an `EXPO_PUBLIC_*` variable.
 *
 * Expo inlines `EXPO_PUBLIC_*` at build time, so these resolve to whatever was
 * set when the bundle was made. Changing them afterwards means a new build.
 */
export const nhostSubdomain = (): string =>
  process.env['EXPO_PUBLIC_NHOST_SUBDOMAIN'] || LOCAL;

export const nhostRegion = (): string =>
  process.env['EXPO_PUBLIC_NHOST_REGION'] || LOCAL;

/**
 * Where the auth service sends the browser back to, as a link into this app.
 *
 * This is the one real difference from the web templates. There is no origin
 * to come back to: the auth service finishes in the system browser, and the
 * only way back into a native app is a deep link on the scheme declared in
 * `app.json`. `Linking.createURL` builds that, and it builds the right one for
 * however the app is running - `nhoststarter://` in a real build, and the
 * development server's `exp://.../--/` URL under Expo Go.
 *
 * Every value this returns has to be in the backend's
 * `auth.redirections.allowedUrls`, or the service refuses to redirect to it.
 * `nhost init` allows the scheme in nhost.toml and `exp://` in the local
 * overlay only; the README's "Coming back into the app" says why.
 */
export const redirectURL = (path: string): string =>
  Linking.createURL(path.startsWith('/') ? path : `/${path}`);

/**
 * URL of a service in the local stack, on the same hostname pattern `nhost up`
 * prints: <subdomain>.<service>.local.nhost.run over TLS.
 */
export const localServiceURL = (service: string): string =>
  `https://${nhostSubdomain()}.${service}.local.nhost.run`;

/**
 * URL of the local mailbox that captures every email the backend sends, or null
 * when the app targets a real project and the emails go out for real. The
 * region is what decides: a production build pointed at a local stack still
 * has its emails captured.
 */
export const localMailboxURL = (): string | null =>
  nhostRegion() === LOCAL ? localServiceURL('mailhog') : null;

if (
  !__DEV__ &&
  !(
    process.env['EXPO_PUBLIC_NHOST_SUBDOMAIN'] &&
    process.env['EXPO_PUBLIC_NHOST_REGION']
  )
) {
  console.error(
    'Nhost: EXPO_PUBLIC_NHOST_SUBDOMAIN and EXPO_PUBLIC_NHOST_REGION were unset when this bundle was built, so the app targets the local stack (local.*.local.nhost.run), which a device cannot reach. Set both and build again.',
  );
}
