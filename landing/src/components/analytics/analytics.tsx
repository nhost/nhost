import { analytics } from '@/lib/segment';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Analytics() {
  const router = useRouter();

  useEffect(() => {

    analytics.page();

    const handleRouteChange = () => analytics.page();

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return null;
}
