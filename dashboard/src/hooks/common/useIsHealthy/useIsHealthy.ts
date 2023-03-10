import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { useQuery } from '@tanstack/react-query';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region?.awsName,
    'auth',
  );

  const { failureCount, status } = useQuery(
    ['/healthz'],
    () => fetch(`${appUrl}/healthz`),
    {
      enabled: !isPlatform && !!currentApplication,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return isPlatform || (status === 'success' && failureCount === 0);
}
