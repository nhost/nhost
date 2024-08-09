import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';

/**
 * Queries the postgres version of the current project.
 * @returns Major, minor and full version of the postgres database. Loading and error states.
 */
export default function useGetPostgresVersion() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const localMimirClient = useLocalMimirClient();
  const isPlatform = useIsPlatform();

  const {
    data: postgresSettingsData,
    loading,
    error,
  } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { version } = postgresSettingsData?.config?.postgres || {};
  const [postgresMajor, postgresMinor] = version?.split('.') || [
    undefined,
    undefined,
  ];

  return {
    version,
    postgresMajor,
    postgresMinor,
    loading,
    error,
  };
}
