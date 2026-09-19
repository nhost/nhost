import { headers } from 'next/headers';

const isDevelopment = (): boolean => process.env.NODE_ENV !== 'production';

/**
 * Normalise a configured `APP_ORIGIN` to a bare origin, or throw a clear
 * configuration error. Taking the value verbatim let `example.com` or
 * `https://example.com/app/` through, producing a `redirectTo` the auth
 * service silently rejects at send time; parsing here turns that into an
 * explicit error that names the variable.
 */
function normalizeConfiguredOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `APP_ORIGIN is not a valid URL (got "${value}"). Set it to this app's public origin, e.g. https://app.example.com.`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `APP_ORIGIN must use http: or https: (got "${url.protocol}" in "${value}").`,
    );
  }

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(
      `APP_ORIGIN must be a bare origin with no path, query, or fragment (got "${value}").`,
    );
  }

  return url.origin;
}

/**
 * Origin this app is reached at, for links inside auth emails.
 *
 * `APP_ORIGIN` is the answer wherever the app is really deployed. The request
 * headers are only a development convenience, because a header is whatever the
 * client said it was: build a password-reset link out of one and anybody can
 * mail a real user a real reset link pointing at their own host. So outside
 * development this fails closed — an unset `APP_ORIGIN` throws rather than
 * falling back to `Host`, which makes the reset and email-change actions return
 * their "could not send" error instead of mailing a link to an attacker-chosen
 * host. The `Host` fallback survives only in development, where it is a genuine
 * convenience; a proxy in front of the app can rewrite `Host`, so
 * `x-forwarded-host` is not read at all, and the scheme is always http there.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    return normalizeConfiguredOrigin(configured);
  }

  if (!isDevelopment()) {
    throw new Error(
      "APP_ORIGIN is unset. Set it to this app's public origin so auth email links are not built from the request Host header.",
    );
  }

  const host = (await headers()).get('host') ?? 'localhost:3000';

  return `http://${host}`;
}
