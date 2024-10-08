import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/utils/__generated__/graphql';

/**
 * Queries the postgres version of the current project.
 * @returns Major, minor and full version of the postgres database. Loading and error states.
 */
export default function useGetPostgresVersion() {
  const { project } = useProject();
  const localMimirClient = useLocalMimirClient();
  const isPlatform = useIsPlatform();

  const {
    data: postgresSettingsData,
    loading,
    error,
  } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
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
