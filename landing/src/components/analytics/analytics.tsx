import { analytics, loadAnalytics } from '@/lib/segment';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import CookieConsent from './CookieConsent';
import { useCookieConsent } from './useCookieConsent';

export default function Analytics() {
  const router = useRouter();
  const [consent, setConsent] = useCookieConsent();

  useEffect(() => {
    // Segment (and the Google Ads tag it loads) only runs after consent.
    if (consent !== true) {
      return;
    }

    loadAnalytics();
    analytics.page();

    // Shallow route changes include the blog search syncing each keystroke
    // into `?q=`; tracking those would stream the search term to Segment.
    const handleRouteChange = (_url: string, { shallow }: { shallow: boolean }) => {
      if (!shallow) {
        analytics.page();
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [consent, router.events]);

  if (consent !== null) {
    return null;
  }

  return (
    <CookieConsent
      onAccept={() => setConsent(true)}
      onReject={() => setConsent(false)}
    />
  );
}
