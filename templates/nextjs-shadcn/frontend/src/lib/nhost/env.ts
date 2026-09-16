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
