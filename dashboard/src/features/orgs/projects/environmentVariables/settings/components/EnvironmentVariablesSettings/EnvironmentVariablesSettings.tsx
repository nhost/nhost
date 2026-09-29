import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { EnvironmentVariableSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariableSettings';
import { SystemEnvironmentVariableSettings } from '@/features/orgs/projects/environmentVariables/settings/components/SystemEnvironmentVariableSettings';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetEnvironmentVariablesQuery } from '@/generated/graphql';

export default function EnvironmentVariablesSettings() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading environment variables...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <EnvironmentVariableSettings />
      <SystemEnvironmentVariableSettings />
    </div>
  );
}
