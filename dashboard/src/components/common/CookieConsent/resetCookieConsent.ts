import { resetAnalytics } from '@/lib/segment';
import { deleteConsentCookie } from './consentCookie';

/** Forgets the user's cookie choice and reloads, so the banner is shown again. */
export default async function resetCookieConsent() {
  await resetAnalytics();
  deleteConsentCookie();
  window.location.reload();
}
