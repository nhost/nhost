import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { EnvironmentVariableSettings } from '@/features/projects/environmentVariables/settings/components/EnvironmentVariableSettings';
import { SystemEnvironmentVariableSettings } from '@/features/projects/environmentVariables/settings/components/SystemEnvironmentVariableSettings';
import { useGetEnvironmentVariablesQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function EnvironmentVariablesPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentProject?.id },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <EnvironmentVariableSettings />
      <SystemEnvironmentVariableSettings />
    </Container>
  );
}

EnvironmentVariablesPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
