import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';

export default function useGetNhostFunctions() {
  const { project } = useProject();

  const { data, loading, error } = useGetAppFunctionsMetadataQuery({
    variables: { id: project?.id },
    skip: !project?.id,
  });

  const functions: NhostFunction[] =
    (data?.app?.metadataFunctions as NhostFunction[] | undefined) ?? [];

  return {
    data: functions,
    loading,
    error,
  };
}
