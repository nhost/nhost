import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { baseServices } from '@/features/projects/overview/health';
import {
  useGetRecommendedSoftwareVersionsQuery,
  type GetRecommendedSoftwareVersionsQuery,
  type GetRecommendedSoftwareVersionsQueryVariables,
} from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';

export interface UseRecommendedVersionsOptions
  extends QueryHookOptions<
    GetRecommendedSoftwareVersionsQuery,
    GetRecommendedSoftwareVersionsQueryVariables
  > {}

export default function useRecommendedVersions(
  options: UseRecommendedVersionsOptions = {},
): {
  loading: boolean;
  auth: string[];
  storage: string[];
  postgres: string[];
  hasura: string[];
  ai: string[];
} {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading } = useGetRecommendedSoftwareVersionsQuery({
    ...options,
    skip: !isPlatform || !currentProject,
  });

  const getRecommendedVersions = (softwareName: string): string[] =>
    data?.softwareVersions
      .filter(({ software }) => software === softwareName)
      .map(({ version }) => version) ?? [];

  return {
    loading,
    auth: getRecommendedVersions(
      baseServices['hasura-auth'].softwareVersionsName,
    ),
    storage: getRecommendedVersions(
      baseServices['hasura-storage'].softwareVersionsName,
    ),
    postgres: getRecommendedVersions(
      baseServices.postgres.softwareVersionsName,
    ),
    hasura: getRecommendedVersions(baseServices.hasura.softwareVersionsName),
    ai: getRecommendedVersions(baseServices.ai.softwareVersionsName),
  };
}
