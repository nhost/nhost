import { useQuery } from '@tanstack/react-query';
import { metadataOperation } from '../generated/default/default';
import { useHasuraContext } from './useHasuraContext';

export function useGetRemoteSchemas() {
  const project = useHasuraContext(); // Reuse shared context setup logic

  return useQuery(
    ['hasura-metadata', project?.subdomain],
    async () => {
      const result = await metadataOperation({
        type: 'export_metadata',
      });

      return result;
    },
    {
      enabled: !!project, // Only run when project is available
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
      cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    },
  );
}
