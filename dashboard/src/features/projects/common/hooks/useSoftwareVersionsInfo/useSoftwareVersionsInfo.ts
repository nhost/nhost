import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  Software_Type_Enum,
  useGetConfiguredVersionsQuery,
  useGetRecommendedSoftwareVersionsQuery,
  type GetConfiguredVersionsQuery,
  type GetConfiguredVersionsQueryVariables,
} from '@/utils/__generated__/graphql';
import type { QueryHookOptions } from '@apollo/client';
import { useVisibilityChange } from '@uidotdev/usehooks';
import { useEffect } from 'react';

export interface UseSoftwareVersionsInfoOptions
  extends QueryHookOptions<
    GetConfiguredVersionsQuery,
    GetConfiguredVersionsQueryVariables
  > {}

type ServiceVersionInfo = {
  configuredVersion: string | undefined;
  recommendedVersions: string[];
  isVersionMismatch: boolean;
};

export default function useSoftwareVersionsInfo(
  options: UseSoftwareVersionsInfoOptions = {},
): {
  loading: boolean;
  auth: ServiceVersionInfo;
  storage: ServiceVersionInfo;
  postgres: ServiceVersionInfo;
  hasura: ServiceVersionInfo;
  ai: ServiceVersionInfo;
  isAIEnabled: boolean;
} {
  const isPlatform = useIsPlatform();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  // Recommended software versions are not polled by default
  const { data: recommendedVersionsData, loading: loadingRecommendedVersions } =
    useGetRecommendedSoftwareVersionsQuery({
      skip: !isPlatform || !currentProject,
    });

  const {
    data: configuredVersionsData,
    loading: loadingConfiguredVersions,
    refetch: refetchConfiguredVersions,
    stopPolling,
  } = useGetConfiguredVersionsQuery({
    ...options,
    variables: { ...options.variables, appId: currentProject?.id },
    skip: !isPlatform || !currentProject,
    skipPollAttempt: () => !isVisible,
    pollInterval: options.pollInterval || 10000,
  });

  // fetch when mounted
  useEffect(() => {
    refetchConfiguredVersions();
    return () => stopPolling();
  }, [refetchConfiguredVersions, stopPolling]);

  const recommendedVersions = {
    'hasura-auth': [],
    'hasura-storage': [],
    postgres: [],
    hasura: [],
    ai: [],
  };

  recommendedVersionsData?.softwareVersions.forEach(({ software, version }) => {
    switch (software) {
      case Software_Type_Enum.Auth:
        recommendedVersions['hasura-auth'].push(version);
        break;
      case Software_Type_Enum.Storage:
        recommendedVersions['hasura-storage'].push(version);
        break;
      case Software_Type_Enum.PostgreSql:
        recommendedVersions.postgres.push(version);
        break;
      case Software_Type_Enum.Hasura:
        recommendedVersions.hasura.push(version);
        break;
      case Software_Type_Enum.Graphite:
        recommendedVersions.ai.push(version);
        break;
      default:
        break;
    }
  });

  const isVersionMismatch = (
    service: string,
    configuredVersion: string | undefined,
  ) =>
    !recommendedVersions[service].some(
      (version) => version === configuredVersion,
    );

  // Check if configured version can't be found in recommended versions
  const isAuthVersionMismatch = isVersionMismatch(
    'hasura-auth',
    configuredVersionsData?.config?.auth?.version,
  );
  const isStorageVersionMismatch = isVersionMismatch(
    'hasura-storage',
    configuredVersionsData?.config?.storage?.version,
  );
  const isPostgresVersionMismatch = isVersionMismatch(
    'postgres',
    configuredVersionsData?.config?.postgres?.version,
  );
  const isHasuraVersionMismatch = isVersionMismatch(
    'hasura',
    configuredVersionsData?.config?.hasura?.version,
  );
  const isAIVersionMismatch = isVersionMismatch(
    'ai',
    configuredVersionsData?.config?.ai?.version,
  );

  return {
    loading: loadingConfiguredVersions || loadingRecommendedVersions,
    auth: {
      configuredVersion: configuredVersionsData?.config?.auth?.version,
      recommendedVersions: recommendedVersions['hasura-auth'],
      isVersionMismatch: isAuthVersionMismatch,
    },
    storage: {
      configuredVersion: configuredVersionsData?.config?.storage?.version,
      recommendedVersions: recommendedVersions['hasura-storage'],
      isVersionMismatch: isStorageVersionMismatch,
    },
    postgres: {
      configuredVersion: configuredVersionsData?.config?.postgres?.version,
      recommendedVersions: recommendedVersions.postgres,
      isVersionMismatch: isPostgresVersionMismatch,
    },
    hasura: {
      configuredVersion: configuredVersionsData?.config?.hasura?.version,
      recommendedVersions: recommendedVersions.hasura,
      isVersionMismatch: isHasuraVersionMismatch,
    },
    ai: {
      configuredVersion: configuredVersionsData?.config?.ai?.version,
      recommendedVersions: recommendedVersions.ai,
      isVersionMismatch: isAIVersionMismatch,
    },
    isAIEnabled: Boolean(configuredVersionsData?.config?.ai),
  };
}
