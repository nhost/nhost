const LOCAL = 'local';

export const nhostSubdomain = (): string =>
  import.meta.env.VITE_NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string =>
  import.meta.env.VITE_NHOST_REGION || LOCAL;

/** Where this app is deployed, for links that have to point back at it. */
export const appOrigin = (): string =>
  import.meta.env.VITE_APP_ORIGIN || window.location.origin;

/** The OAuth providers this deployment turns on, as a comma-separated list. */
export const oauthProviders = (): string | undefined =>
  import.meta.env.VITE_NHOST_OAUTH_PROVIDERS;
