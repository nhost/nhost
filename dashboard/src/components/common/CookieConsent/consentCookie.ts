// The user's cookie choice is kept in one first-party cookie on nhost.io, so a
// single choice covers both the dashboard and nhost.io. The landing site has
// the same logic in landing/src/lib/cookieConsent.ts.

export const CONSENT_COOKIE = 'nhost-cookie-consent';

// Keep the choice for 6 months, then ask again.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

// Before the cookie, the dashboard kept the choice in local storage.
const LEGACY_STORAGE_KEY = 'cookie-consent';

export function getCookieDomain() {
  const { hostname } = window.location;
  // Elsewhere (localhost, preview deployments) the cookie stays on the current host.
  return hostname === 'nhost.io' || hostname.endsWith('.nhost.io')
    ? 'nhost.io'
    : undefined;
}

function attributes(maxAgeSeconds: number) {
  const cookieDomain = getCookieDomain();
  const domain = cookieDomain ? `; Domain=${cookieDomain}` : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  return `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${domain}${secure}`;
}

/** `true` accepted, `false` rejected, `null` no choice yet. */
export function readConsentCookie(): boolean | null {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);

  if (value === 'accepted') {
    return true;
  }

  if (value === 'rejected') {
    return false;
  }

  return null;
}

export function writeConsentCookie(accepted: boolean) {
  const value = accepted ? 'accepted' : 'rejected';
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and not in every browser we support
  document.cookie = `${CONSENT_COOKIE}=${value}${attributes(MAX_AGE_SECONDS)}`;
}

export function deleteConsentCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and not in every browser we support
  document.cookie = `${CONSENT_COOKIE}=${attributes(0)}`;
}

/** Moves a choice saved in local storage before the cookie existed into the cookie. */
export function migrateLegacyConsent() {
  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) {
      return;
    }

    window.localStorage.removeItem(LEGACY_STORAGE_KEY);

    if (
      readConsentCookie() === null &&
      (legacy === 'true' || legacy === 'false')
    ) {
      writeConsentCookie(legacy === 'true');
    }
  } catch {
    // Local storage unavailable: nothing to migrate.
  }
}
