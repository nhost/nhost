// Expo inlines each `process.env.EXPO_PUBLIC_*` at bundle time, and only when
// it is written out in full, so every read below names its variable.

const LOCAL = 'local';

/** The scheme `app.config.ts` registers, which every link back in uses. */
export const APP_SCHEME = 'nhost-starter';

export const nhostSubdomain = (): string =>
  process.env.EXPO_PUBLIC_NHOST_SUBDOMAIN || LOCAL;

export const nhostRegion = (): string =>
  process.env.EXPO_PUBLIC_NHOST_REGION || LOCAL;

/** The OAuth providers this deployment turns on, as a comma-separated list. */
export const oauthProviders = (): string | undefined =>
  process.env.EXPO_PUBLIC_NHOST_OAUTH_PROVIDERS || undefined;

/** The domain passkeys are bound to; passkeys are off without one. */
export const passkeyDomain = (): string | undefined =>
  process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN || undefined;

function splitAt(value: string, separator: string): [string, string] {
  const at = value.indexOf(separator);
  return at === -1 ? [value, ''] : [value.slice(0, at), value.slice(at + 1)];
}

/**
 * A link back into the app at `path`, for auth to redirect to:
 * `appUrl('/account', { flow })` is `nhost-starter://account?flow=…`. Built as
 * a string because React Native's global `URL` cannot parse a custom scheme.
 */
export function appUrl(path = '/', query: Record<string, string> = {}): string {
  const [rest, hash] = splitAt(path, '#');
  const [pathname, search] = splitAt(rest, '?');
  const params = [
    search,
    ...Object.entries(query).map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    ),
  ].filter(Boolean);

  return [
    `${APP_SCHEME}://${pathname.replace(/^\//, '')}`,
    params.length > 0 ? `?${params.join('&')}` : '',
    hash ? `#${hash}` : '',
  ].join('');
}
