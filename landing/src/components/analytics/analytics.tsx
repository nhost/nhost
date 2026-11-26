import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { analytics, loadAnalytics } from '@/lib/segment';
import CookieConsent from './CookieConsent';
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  useCookieConsent,
  withdrawCookieConsent,
} from './useCookieConsent';

export default function Analytics() {
  const router = useRouter();
  const [consent, setConsent] = useCookieConsent();
  // Reopened from "Cookie settings" after a choice was made.
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Segment (and the Google Ads tag it loads) only runs after consent.
    if (consent !== true) {
      return;
    }

    loadAnalytics();
    analytics.page();

    // Shallow route changes include the blog search syncing each keystroke
    // into `?q=`; tracking those would stream the search term to Segment.
    const handleRouteChange = (
      _url: string,
      { shallow }: { shallow: boolean },
    ) => {
      if (!shallow) {
        analytics.page();
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [consent, router.events]);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);

    return () =>
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  // `undefined` until the choice is read on the client.
  if (consent === undefined || (consent !== null && !settingsOpen)) {
    return null;
  }

  const handleAccept = () => {
    setConsent(true);
    setSettingsOpen(false);
  };

  const handleReject = () => {
    // Segment is already running, and only a reload stops it.
    if (consent === true) {
      withdrawCookieConsent();
      return;
    }

    setConsent(false);
    setSettingsOpen(false);
  };

  return (
    <CookieConsent
      consent={consent}
      onAccept={handleAccept}
      onReject={handleReject}
      onClose={() => setSettingsOpen(false)}
    />
  );
}
