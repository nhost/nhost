import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useQuery } from '@tanstack/react-query';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const { failureCount, status } = useQuery(
    ['/v1/auth/healthz'],
    () => fetch(`${process.env.NEXT_PUBLIC_NHOST_BACKEND_URL}/v1/auth/healthz`),
    {
      enabled: !isPlatform,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return isPlatform || (status === 'success' && failureCount === 0);
}
