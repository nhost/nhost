import { useQuery } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useNhostClient } from '@/providers/nhost';
import {
  GetAppFunctionsMetadataDocument,
  type GetAppFunctionsMetadataQuery,
} from '@/utils/__generated__/graphql';

const NHOST_FUNCTIONS_STALE_TIME = 5 * 60_000;

export default function useGetNhostFunctions() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const appClient = useAppClient();
  const nhost = useNhostClient();

  const { data, isLoading, error } = useQuery<NhostFunction[]>({
    queryKey: ['nhostFunctions', project?.id, isPlatform],
    queryFn: async () => {
      if (isPlatform) {
        const response =
          await nhost.graphql.request<GetAppFunctionsMetadataQuery>(
            GetAppFunctionsMetadataDocument,
            { id: project?.id },
          );
        const app = response?.body.data?.app;
        if (!app) {
          throw new Error('Failed to load function metadata');
        }
        return (app.metadataFunctions ?? []) as NhostFunction[];
      }

      const res = await fetch(
        `${appClient.functions.baseURL}/_nhost_functions_metadata`,
      );
      if (!res.ok) {
        throw new Error(
          `Failed to fetch functions metadata: ${res.statusText}`,
        );
      }
      const json = await res.json();
      return json.functions ?? [];
    },
    enabled: !!project?.id,
    staleTime: NHOST_FUNCTIONS_STALE_TIME,
  });

  return { data: data ?? [], loading: isLoading, error };
}
