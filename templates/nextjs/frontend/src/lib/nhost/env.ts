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

// Matches the `clientUrl` a fresh `nhost init` writes into the backend, so a
// local project works with nothing configured.
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
 * `next build`, not on the running host. On Vercel it can be left unset: Vercel
 * sets the project's production domain on every build, previews included, and
 * that comes from the project's settings rather than from a request.
 */
export const appOrigin = (): string =>
  process.env.NEXT_PUBLIC_APP_ORIGIN || vercelOrigin() || DEFAULT_APP_ORIGIN;

const vercelOrigin = (): string | undefined => {
  const domain = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return domain ? `https://${domain}` : undefined;
};

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
  isLocalBackend() ? localServiceURL('mailhog') : null;

/** Whether the app targets the stack `nhost up` runs rather than a project. */
export const isLocalBackend = (): boolean => nhostRegion() === LOCAL;

/**
 * Where to manage the backend: the local stack's own dashboard, or the Nhost
 * dashboard's project picker. The app knows a cloud project's subdomain but
 * not the organization it belongs to, and the dashboard has no URL that
 * finds a project from its subdomain alone.
 */
export const dashboardURL = (): string =>
  isLocalBackend()
    ? localServiceURL('dashboard')
    : 'https://app.nhost.io/orgs/_/projects/_';

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

if (
  process.env.NODE_ENV === 'production' &&
  appOrigin() === DEFAULT_APP_ORIGIN
) {
  console.error(
    'Nhost: NEXT_PUBLIC_APP_ORIGIN was unset when this build ran, so auth emails point at http://localhost:3000. Set it before `next build`; setting it at runtime has no effect.',
  );
}
