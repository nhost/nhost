import { resetAnalytics } from '@/lib/segment';
import { deleteConsentCookie } from './consentCookie';

/** Forgets the user's cookie choice and reloads, so the banner is shown again. */
export default function resetCookieConsent() {
  try {
    resetAnalytics();
  } catch (error: unknown) {
    console.error('Failed to reset analytics:', error);
  } finally {
    deleteConsentCookie();
    window.location.reload();
  }
}
