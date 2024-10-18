import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useGetStorageSettingsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ContactPointsSettings } from '@/features/orgs/projects/metrics/settings/components/ContactPointsSettings';
import { GrafanaAlertingSettings } from '@/features/orgs/projects/metrics/settings/components/GrafanaAlertingSettings';

export default function MetricsSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();

  const { loading, error } = useGetStorageSettingsQuery({
    variables: { appId: project?.id },
    skip: !project,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading Observability settings..."
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
      <GrafanaAlertingSettings />
      <ContactPointsSettings />
    </Container>
  );
}

MetricsSettingsPage.getLayout = function getLayout(page: ReactElement) {
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
