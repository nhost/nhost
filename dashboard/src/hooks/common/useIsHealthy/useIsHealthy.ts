import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useNhostClient } from '@nhost/nextjs';
import { useQuery } from '@tanstack/react-query';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const client = useNhostClient();
  const { failureCount, status } = useQuery(
    ['/healthz'],
    () => fetch(`${client.auth.url}/healthz`),
    {
      enabled: !isPlatform,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return isPlatform || (status === 'success' && failureCount === 0);
}
