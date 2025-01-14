import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { DatabaseConnectionInfo } from '@/features/orgs/projects/database/settings/components/DatabaseConnectionInfo';
import { DatabaseServiceVersionSettings } from '@/features/orgs/projects/database/settings/components/DatabaseServiceVersionSettings';
import { DatabaseStorageCapacity } from '@/features/orgs/projects/database/settings/components/DatabaseStorageCapacity';
import { ResetDatabasePasswordSettings } from '@/features/orgs/projects/database/settings/components/ResetDatabasePasswordSettings';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetPostgresSettingsQuery } from '@/generated/graphql';
import type { ReactElement } from 'react';

export default function DatabaseSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();

  const { loading, error } = useGetPostgresSettingsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loadingProject || loading) {
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
    <ProjectLayout>
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
