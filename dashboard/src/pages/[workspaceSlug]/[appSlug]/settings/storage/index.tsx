import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { StorageServiceVersionSettings } from '@/features/storage/settings/components/HasuraServiceVersionSettings';
import { HasuraStorageAVSettings } from '@/features/storage/settings/components/HasuraStorageAVSettings';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetStorageSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function StorageSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetStorageSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Storage settings..."
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
      <StorageServiceVersionSettings />
      <HasuraStorageAVSettings />
    </Container>
  );
}

StorageSettingsPage.getLayout = function getLayout(page: ReactElement) {
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
