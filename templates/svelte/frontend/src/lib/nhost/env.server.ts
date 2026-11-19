import {
  APP_ORIGIN,
  NHOST_REGION,
  NHOST_SUBDOMAIN,
  VERCEL_PROJECT_PRODUCTION_URL,
} from '$app/env/private';

const LOCAL = 'local';

export const nhostSubdomain = (): string => NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string => NHOST_REGION || LOCAL;

// Matches the `clientUrl` a fresh `nhost init` writes into the backend, so a
// local project works with nothing configured.
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

/** Where this app is deployed, for links that have to point back at it. */
export const appOrigin = (): string =>
  APP_ORIGIN || vercelOrigin() || DEFAULT_APP_ORIGIN;

const vercelOrigin = (): string | undefined =>
  VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;

/** Says which defaults a production server is running on. */
export function warnAboutDefaults(): void {
  if (!(NHOST_SUBDOMAIN && NHOST_REGION)) {
    console.error(
      'Nhost: NHOST_SUBDOMAIN and NHOST_REGION are unset, so the app targets the local stack (local.*.local.nhost.run). Set both in the environment the server runs in.',
    );
  }

  if (appOrigin() === DEFAULT_APP_ORIGIN) {
    console.error(
      'Nhost: APP_ORIGIN is unset, so auth emails point at http://localhost:3000. Set it in the environment the server runs in.',
    );
  }
}
