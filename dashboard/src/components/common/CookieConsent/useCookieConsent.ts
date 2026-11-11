import { useCallback, useEffect, useState } from 'react';
import { clearAnalyticsStorage } from '@/lib/segment';
import {
  migrateLegacyConsent,
  readConsentCookie,
  writeConsentCookie,
} from './consentCookie';

const CHANGE_EVENT = 'nhost-cookie-consent-change';

/**
 * The user's cookie choice, shared with nhost.io: `true` accepted, `false`
 * rejected, `null` no choice yet, and `undefined` until read on the client.
 * Every component using it updates when the choice changes.
 */
export default function useCookieConsent() {
  const [consent, setConsentState] = useState<boolean | null>();

  useEffect(() => {
    migrateLegacyConsent();

    const sync = () => {
      const savedConsent = readConsentCookie();
      if (savedConsent === false) {
        clearAnalyticsStorage();
      }
      // If the browser blocks cookies, keep the choice made on this page.
      setConsentState((current) => savedConsent ?? current ?? null);
    };

    sync();
    window.addEventListener(CHANGE_EVENT, sync);

    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  useEffect(() => {
    // A missing choice can also mean consent was reset on the other property.
    if (consent === null) {
      clearAnalyticsStorage();
    }
  }, [consent]);

  const setConsent = useCallback((accepted: boolean) => {
    if (!accepted) {
      clearAnalyticsStorage();
    }
    writeConsentCookie(accepted);
    setConsentState(accepted);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [consent, setConsent] as const;
}
