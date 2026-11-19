import { analytics } from '@/lib/segment';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Analytics() {
  const router = useRouter();

  useEffect(() => {

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
  }, [router.events]);

  return null;
}
