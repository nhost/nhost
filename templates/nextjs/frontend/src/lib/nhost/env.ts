const LOCAL = 'local';

/** Backend coordinates. */
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
