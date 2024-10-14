import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { DatabaseConnectionInfo } from '@/features/database/settings/components/DatabaseConnectionInfo';
import { DatabaseServiceVersionSettings } from '@/features/database/settings/components/DatabaseServiceVersionSettings';
import { DatabaseStorageCapacity } from '@/features/database/settings/components/DatabaseStorageCapacity';
import { ResetDatabasePasswordSettings } from '@/features/database/settings/components/ResetDatabasePasswordSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';
import useLocalMimirClient from '@/hooks/useLocalMimirClient/useLocalMimirClient';
import type { ReactElement } from 'react';

export default function DatabaseSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetPostgresSettingsQuery({
    variables: { appId: currentProject?.id },
    skip: !currentProject,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Postgres settings..."
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
      <DatabaseServiceVersionSettings />
      <DatabaseStorageCapacity />

      {isPlatform && (
        <>
          <DatabaseConnectionInfo />
          <ResetDatabasePasswordSettings />
        </>
      )}
    </Container>
  );
}

DatabaseSettingsPage.getLayout = function getLayout(page: ReactElement) {
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
