import { useCurrentWorkspaceAndProject } from '@/features/projects/common/useCurrentWorkspaceAndProject';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { useQuery } from '@tanstack/react-query';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const appUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region?.awsName,
    'auth',
  );

  const { failureCount, status } = useQuery(
    ['/healthz'],
    () => fetch(`${appUrl}/healthz`),
    {
      enabled: !isPlatform && !!currentProject,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return isPlatform || (status === 'success' && failureCount === 0);
}
