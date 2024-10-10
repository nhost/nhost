import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { HasuraAllowListSettings } from '@/features/hasura/settings/components/HasuraAllowListSettings';
import { HasuraConsoleSettings } from '@/features/hasura/settings/components/HasuraConsoleSettings';
import { HasuraCorsDomainSettings } from '@/features/hasura/settings/components/HasuraCorsDomainSettings';
import { HasuraDevModeSettings } from '@/features/hasura/settings/components/HasuraDevModeSettings';
import { HasuraEnabledAPISettings } from '@/features/hasura/settings/components/HasuraEnabledAPISettings';
import { HasuraInferFunctionPermissionsSettings } from '@/features/hasura/settings/components/HasuraInferFunctionPermissionsSettings';
import { HasuraLogLevelSettings } from '@/features/hasura/settings/components/HasuraLogLevelSettings';
import { HasuraPoolSizeSettings } from '@/features/hasura/settings/components/HasuraPoolSizeSettings';
import { HasuraRemoteSchemaPermissionsSettings } from '@/features/hasura/settings/components/HasuraRemoteSchemaPermissionsSettings';
import { HasuraServiceVersionSettings } from '@/features/hasura/settings/components/HasuraServiceVersionSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function HasuraSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (!data && loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Hasura settings..."
        className="justify-center"
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <HasuraServiceVersionSettings />
      <HasuraLogLevelSettings />
      <HasuraEnabledAPISettings />
      <HasuraPoolSizeSettings />
      <HasuraCorsDomainSettings />
      <HasuraConsoleSettings />
      <HasuraDevModeSettings />
      <HasuraAllowListSettings />
      <HasuraRemoteSchemaPermissionsSettings />
      <HasuraInferFunctionPermissionsSettings />
    </Container>
  );
}

HasuraSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
