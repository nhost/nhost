const LOCAL = 'local';

/**
 * Backend coordinates for the client this app creates.
 *
 * A subdomain and a region are not secrets: they appear in every request URL
 * the browser makes. There is nothing else to hide here either, because this
 * app is entirely a browser app, so anything it is built with ships to the
 * visitor. Never put a secret in a `VITE_*` variable.
 *
 * Vite inlines `VITE_*` at build time, so these resolve to whatever was set
 * when `vite build` ran. Setting them on the running host, or serving a bundle
 * built without them, has no effect.
 */
export const nhostSubdomain = (): string =>
  import.meta.env.VITE_NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string =>
  import.meta.env.VITE_NHOST_REGION || LOCAL;

/**
 * Where this app is deployed, for links that have to point back at it.
 *
 * Auth emails are the reason this exists. A browser app could read its own
 * `window.location.origin`, which is correct far more often than not, but it
 * is whatever origin the page was served from: a copy of this app on a host
 * someone else controls would ask the backend to send sign-in links pointing
 * there. The auth service's `allowedUrls` is the backstop that rejects it, but
 * relying on it means the day that list is widened for preview deployments,
 * the leak opens. Configuration cannot be swapped out by whoever loads the
 * page, so this is configuration.
 *
 * Same build-time rule as the pair above: set `VITE_APP_ORIGIN` before
 * `vite build`, not on the running host.
 */
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

export const appOrigin = (): string =>
  import.meta.env.VITE_APP_ORIGIN || DEFAULT_APP_ORIGIN;

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
  import.meta.env.PROD &&
  !(import.meta.env.VITE_NHOST_SUBDOMAIN && import.meta.env.VITE_NHOST_REGION)
) {
  console.error(
    'Nhost: VITE_NHOST_SUBDOMAIN and VITE_NHOST_REGION were unset when this build ran, so the app targets the local stack (local.*.local.nhost.run). Set both before `vite build`; setting them at runtime has no effect.',
  );
}

if (import.meta.env.PROD && !import.meta.env.VITE_APP_ORIGIN) {
  console.error(
    'Nhost: VITE_APP_ORIGIN was unset when this build ran, so auth emails point at http://localhost:3000. Set it before `vite build`; setting it at runtime has no effect.',
  );
}
