import { useQuery } from '@tanstack/react-query';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';

export default function useGetNhostFunctions() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const appClient = useAppClient();

  const {
    data: platformData,
    loading: platformLoading,
    error: platformError,
  } = useGetAppFunctionsMetadataQuery({
    variables: { id: project?.id },
    skip: !project?.id || !isPlatform,
  });

  const {
    data: localData,
    isLoading: localLoading,
    error: localError,
  } = useQuery<NhostFunction[]>({
    queryKey: ['localFunctionsMetadata'],
    queryFn: async () => {
      const res = await fetch(
        `${appClient.functions.baseURL}/_nhost_functions_metadata`,
      );
      if (!res.ok) {
        throw new Error(
          `Failed to fetch functions metadata: ${res.statusText}`,
        );
      }
      return res.json();
    },
    enabled: !isPlatform,
  });

  if (isPlatform) {
    const functions: NhostFunction[] =
      (platformData?.app?.metadataFunctions as NhostFunction[] | undefined) ??
      [];
    return { data: functions, loading: platformLoading, error: platformError };
  }

  return {
    data: localData ?? [],
    loading: localLoading,
    error: localError,
  };
}
