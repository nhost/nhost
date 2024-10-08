import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
    <SettingsLayout>
      <Container
        className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
        rootClassName="bg-transparent"
      >
        {page}
      </Container>
    </SettingsLayout>
  );
};
