import { UnlockFeatureByUpgrading } from '@/components/applications/UnlockFeatureByUpgrading';
import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import ResourcesForm from '@/components/settings/resources/ResourcesForm';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import ActivityIndicator from '@/ui/v2/ActivityIndicator/ActivityIndicator';
import type { ReactElement } from 'react';

export default function ResourceSettingsPage() {
  const { currentProject, loading } = useCurrentWorkspaceAndProject();

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading project..." />;
  }

  if (currentProject?.plan.isFree) {
    return (
      <UnlockFeatureByUpgrading message="Unlock Resource settings by upgrading your project to the Pro plan." />
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
