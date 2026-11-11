import { AnalyticsBrowser } from '@segment/analytics-next'
import { getCookieDomain } from '@/lib/cookieConsent'

// Segment is only loaded once the visitor accepts cookies (see
// components/analytics). Until then nothing is loaded or sent.
export const analytics = new AnalyticsBrowser()

let loaded = false

export function loadAnalytics() {
  if (loaded) {
    return
  }

  loaded = true
  analytics.load(
    {
      cdnURL: process.env.NEXT_PUBLIC_SEGMENT_CDN_URL!,
      writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
    },
    {
      // Outside production (local dev, previews) the banner still works, but
      // Segment returns a no-op instance: nothing is fetched, stored or sent.
      disable: process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production',
    },
  )
}

// Keep these keys in sync with dashboard/src/lib/segment.ts: the cookies are shared.
const ANALYTICS_STORAGE_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
] as const

/** Removes persisted identifiers without loading or waiting for Segment. */
export function clearAnalyticsStorage() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const domain = getCookieDomain()

  for (const key of ANALYTICS_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage can be blocked independently of cookies.
    }

    const expiredCookie = `${key}=; Path=/; Max-Age=0`
    document.cookie = expiredCookie
    if (domain) {
      document.cookie = `${expiredCookie}; Domain=${domain}`
    }
  }
}

export function resetAnalytics() {
  clearAnalyticsStorage()
  if (loaded) {
    try {
      // The buffered reset never settles if Segment fails to load.
      analytics.instance?.reset()
    } finally {
      clearAnalyticsStorage()
    }
  }
}
