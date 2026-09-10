import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';

export default function ResourceSettingsPage() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-compute-resources"
          title="To unlock Compute Resources, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  return <ResourcesForm />;
}

ResourceSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <SettingsGuard>
          <ProjectStateGate>
            <SettingsArea>{page}</SettingsArea>
          </ProjectStateGate>
        </SettingsGuard>
      </ProjectScope>
    </AppLayout>
  );
};
