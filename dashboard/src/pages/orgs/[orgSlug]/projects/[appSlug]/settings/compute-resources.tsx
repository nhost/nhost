import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { UpgradeNotification } from '@/features/orgs/projects/common/components/UpgradeNotification';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';
import type { ReactElement } from 'react';

export default function ResourceSettingsPage() {
  const { org, loading: loadingOrg } = useCurrentOrg();
  const { loading: loadingProject } = useProject();

  if (loadingOrg || loadingProject) {
    return <ActivityIndicator delay={1000} label="Loading project..." />;
  }

  if (org?.plan?.isFree) {
    return (
      <UpgradeNotification message="Unlock Compute settings by upgrading your organization to the Pro plan." />
    );
  }

  return <ResourcesForm />;
}

ResourceSettingsPage.getLayout = function getLayout(page: ReactElement) {
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
