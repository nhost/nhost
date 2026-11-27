import { resetAnalytics } from '@/lib/segment';
import { writeConsentCookie } from './consentCookie';

/**
 * Saves a rejection made after Segment loaded. Segment, and the Google Ads tag
 * it loads, keep running until the page is reloaded, so this also clears their
 * identifiers and reloads.
 */
export default function withdrawCookieConsent() {
  try {
    resetAnalytics();
  } catch (error: unknown) {
    console.error('Failed to reset analytics:', error);
  } finally {
    writeConsentCookie(false);
    window.location.reload();
  }
}
