const LOCAL = 'local';

/**
 * Backend coordinates shared by the browser client and the server client.
 *
 * Only the `NEXT_PUBLIC_*` pair exists so the two halves of the app can never
 * point at different backends. A subdomain and a region are not secrets: they
 * appear in every request URL the browser makes.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time, so these resolve to whatever
 * was set when `next build` ran. Setting them on the running host, or on a
 * container started from an image built without them, has no effect.
 */
export const nhostSubdomain = (): string =>
  process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string =>
  process.env.NEXT_PUBLIC_NHOST_REGION || LOCAL;

// Matches the `clientUrl` that `nhost create` writes into the generated
// backend, so a local project works with nothing configured.
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

/**
 * Where this app is deployed, for links that have to point back at it.
 *
 * Auth emails are the reason this exists. Their `redirectTo` cannot be taken
 * from the request's own `Host` / `X-Forwarded-Host`, because those are set by
 * whoever made the request: anyone who can reach the app can ask it to send
 * somebody else a password-reset link pointing at a host they control. The
 * auth service's `allowedUrls` is the backstop that rejects it, but relying on
 * it means the day that list is widened for preview deployments, the leak
 * opens. Configuration cannot be spoofed, so this is configuration.
 *
 * Same build-time rule as the pair above: set `NEXT_PUBLIC_APP_ORIGIN` before
 * `next build`, not on the running host.
 */
export const appOrigin = (): string =>
  process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN;

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

/**
 * URL of the local dashboard's row browser for a table in the public schema, or
 * null when the app targets a real project, whose org and project slugs are not
 * known here. Same rule as localMailboxURL: the region is what decides.
 */
export const localTableURL = (table: string): string | null =>
  nhostRegion() === LOCAL
    ? `${localServiceURL(
        'dashboard',
      )}/orgs/${LOCAL}/projects/${LOCAL}/database/browser/default/public/tables/${table}`
    : null;

if (
  process.env.NODE_ENV === 'production' &&
  !(
    process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN &&
    process.env.NEXT_PUBLIC_NHOST_REGION
  )
) {
  console.error(
    'Nhost: NEXT_PUBLIC_NHOST_SUBDOMAIN and NEXT_PUBLIC_NHOST_REGION were unset when this build ran, so the app targets the local stack (local.*.local.nhost.run). Set both before `next build`; setting them at runtime has no effect.',
  );
}
