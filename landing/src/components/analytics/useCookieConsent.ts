import { useCallback, useEffect, useState } from 'react'
import {
  deleteConsentCookie,
  readConsentCookie,
  writeConsentCookie,
} from '@/lib/cookieConsent'
import { clearAnalyticsStorage, resetAnalytics } from '@/lib/segment'

// `true` accepted, `false` rejected, `null` no choice yet.
export type CookieConsentValue = boolean | null

/**
 * The visitor's cookie choice, shared with the dashboard (see
 * lib/cookieConsent). It is `undefined` until read on the client, so the
 * server render and hydration match.
 */
export function useCookieConsent() {
  const [consent, setConsentState] = useState<CookieConsentValue>()

  useEffect(() => {
    const savedConsent = readConsentCookie()
    // A missing choice can also mean consent was reset on the other property.
    if (savedConsent !== true) {
      clearAnalyticsStorage()
    }
    setConsentState(savedConsent)
  }, [])

  const setConsent = useCallback((accepted: boolean) => {
    if (!accepted) {
      clearAnalyticsStorage()
    }
    writeConsentCookie(accepted)
    setConsentState(accepted)
  }, [])

  return [consent, setConsent] as const
}

/** Forgets the visitor's choice and reloads, so the banner is shown again. */
export async function resetCookieConsent() {
  await resetAnalytics()
  deleteConsentCookie()
  window.location.reload()
}
