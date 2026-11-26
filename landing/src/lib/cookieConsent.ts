// The visitor's cookie choice is kept in one first-party cookie on nhost.io, so
// a single choice covers both nhost.io and the dashboard at app.nhost.io. The
// dashboard has the same logic in
// dashboard/src/components/common/CookieConsent/consentCookie.ts.

export const CONSENT_COOKIE = 'nhost-cookie-consent'

// Keep the choice for 6 months, then ask again.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180

export function getCookieDomain() {
  const { hostname } = window.location
  // Elsewhere (localhost, preview deployments) the cookie stays on the current host.
  return hostname === 'nhost.io' || hostname.endsWith('.nhost.io')
    ? 'nhost.io'
    : undefined
}

function attributes(maxAgeSeconds: number) {
  const cookieDomain = getCookieDomain()
  const domain = cookieDomain ? `; Domain=${cookieDomain}` : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''

  return `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${domain}${secure}`
}

/** `true` accepted, `false` rejected, `null` no choice yet. */
export function readConsentCookie(): boolean | null {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1)

  if (value === 'accepted') {
    return true
  }

  if (value === 'rejected') {
    return false
  }

  return null
}

export function writeConsentCookie(accepted: boolean) {
  const value = accepted ? 'accepted' : 'rejected'
  document.cookie = `${CONSENT_COOKIE}=${value}${attributes(MAX_AGE_SECONDS)}`
}

export function deleteConsentCookie() {
  document.cookie = `${CONSENT_COOKIE}=${attributes(0)}`
}
