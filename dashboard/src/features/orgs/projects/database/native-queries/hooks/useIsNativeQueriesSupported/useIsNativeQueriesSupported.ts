import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { MIN_HASURA_VERSION_NATIVE_QUERIES } from '@/features/orgs/projects/database/native-queries/constants';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetConfiguredVersionsQuery } from '@/generated/graphql';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { isVersionGte } from '@/utils/compareVersions';

/**
 * Reports native queries as unsupported only when the configured Hasura version
 * is older than `MIN_HASURA_VERSION_NATIVE_QUERIES`. If the version can't be
 * loaded, the feature stays available.
 */
export default function useIsNativeQueriesSupported() {
  const isPlatform = useIsPlatform();
  const { project } = useProject();
  const localMimirClient = useLocalMimirClient();
  const isSettingsDisabled = useSettingsDisabled();

  const { data, loading } = useGetConfiguredVersionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id || isSettingsDisabled,
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const hasuraVersion = data?.config?.hasura?.version;

  return {
    loading: loading && !data,
    isSupported:
      !hasuraVersion ||
      isVersionGte(hasuraVersion, MIN_HASURA_VERSION_NATIVE_QUERIES),
  };
}
