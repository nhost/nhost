import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { useQuery } from '@tanstack/react-query';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const appUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'hasura',
  );

  const { failureCount, status } = useQuery(
    ['/v1/version'],
    () => fetch(`${appUrl}/v1/version`),
    {
      enabled: !isPlatform && !!project,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return isPlatform || (status === 'success' && failureCount === 0);
}
