import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';

import { HasuraAllowListSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraAllowListSettings';
import { HasuraConsoleSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraConsoleSettings';
import { HasuraCorsDomainSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraCorsDomainSettings';
import { HasuraDevModeSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraDevModeSettings';
import { HasuraEnabledAPISettings } from '@/features/orgs/projects/hasura/settings/components/HasuraEnabledAPISettings';
import { HasuraLogLevelSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraLogLevelSettings';
import { HasuraPoolSizeSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraPoolSizeSettings';
import { HasuraRemoteSchemaPermissionsSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraRemoteSchemaPermissionsSettings';
import { HasuraServiceVersionSettings } from '@/features/orgs/projects/hasura/settings/components/HasuraServiceVersionSettings';

import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function HasuraSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const { data, loading, error } = useGetHasuraSettingsQuery({
    variables: { appId: project?.id },
    skip: !project,
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
      className="grid max-w-5xl grid-flow-row bg-transparent gap-y-6"
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
        <Container
          sx={{ backgroundColor: 'background.default' }}
          className="max-w-5xl"
        >
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
