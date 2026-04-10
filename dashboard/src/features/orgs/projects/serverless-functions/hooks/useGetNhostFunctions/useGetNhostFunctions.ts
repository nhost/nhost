import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  NhostFunction,
  NhostFunctionsMetadata,
} from '@/features/orgs/projects/serverless-functions/types';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';

export default function useGetNhostFunctions() {
  const { project } = useProject();

  const { data, loading, error } = useGetAppFunctionsMetadataQuery({
    variables: { id: project?.id },
    skip: !project?.id,
  });

  const metadata = data?.app?.metadataFunctions as
    | NhostFunctionsMetadata
    | undefined;

  const functions: NhostFunction[] = metadata?.functions ?? [];

  return {
    data: functions,
    loading,
    error,
  };
}
