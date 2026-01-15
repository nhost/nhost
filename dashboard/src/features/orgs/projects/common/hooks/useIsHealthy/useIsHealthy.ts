import { useQuery } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

/**
 * Returns whether or not the app is healthy.
 */
export default function useIsHealthy() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();

  const { failureCount, status, isLoading } = useQuery(
    ['/v1/version'],
    () => {
      const appUrl = generateAppServiceUrl(
        project!.subdomain,
        project!.region,
        'hasura',
      );

      return fetch(`${appUrl}/v1/version`);
    },
    {
      enabled: !isPlatform && !!project,
      retry: true,
      retryDelay: 5000,
      cacheTime: 0,
    },
  );

  return {
    isHealthy: isPlatform || (status === 'success' && failureCount === 0),
    isLoading,
  };
}
