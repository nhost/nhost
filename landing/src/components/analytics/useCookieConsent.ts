import { useCallback, useEffect, useState } from 'react'
import { readConsentCookie, writeConsentCookie } from '@/lib/cookieConsent'
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

/**
 * Saves a rejection made after Segment loaded. Segment, and the Google Ads tag
 * it loads, keep running until the page is reloaded, so this also clears their
 * identifiers and reloads.
 */
export function withdrawCookieConsent() {
  try {
    resetAnalytics()
  } catch (error: unknown) {
    console.error('Failed to reset analytics:', error)
  } finally {
    writeConsentCookie(false)
    window.location.reload()
  }
}

export const OPEN_COOKIE_SETTINGS_EVENT = 'nhost-cookie-settings-open'

/** Shows the cookie banner again, so the visitor can review or change their choice. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}
