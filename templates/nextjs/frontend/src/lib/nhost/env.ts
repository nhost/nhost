const LOCAL = 'local';

/** Backend coordinates shared by the browser client and the server client. */
export const nhostSubdomain = (): string =>
  process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string =>
  process.env.NEXT_PUBLIC_NHOST_REGION || LOCAL;

// Matches the `clientUrl` a fresh `nhost init` writes into the backend, so a
// local project works with nothing configured.
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

/** Where this app is deployed, for links that have to point back at it. */
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
 * when the app targets a real project and the emails go out for real.
 */
export const localMailboxURL = (): string | null =>
  isLocalBackend() ? localServiceURL('mailhog') : null;

/** Whether the app targets the stack `nhost up` runs rather than a project. */
export const isLocalBackend = (): boolean => nhostRegion() === LOCAL;

/**
 * Where to manage the backend: the local stack's own dashboard, or the cloud
 * project's page on the Nhost dashboard.
 */
export const dashboardURL = (): string => {
  if (isLocalBackend()) {
    return localServiceURL('dashboard');
  }

  const orgSlug = process.env.NEXT_PUBLIC_NHOST_ORG_SLUG;
  return orgSlug
    ? `https://app.nhost.io/orgs/${orgSlug}/projects/${nhostSubdomain()}`
    : `https://app.nhost.io/orgs/_/projects/${nhostSubdomain()}`;
};

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
