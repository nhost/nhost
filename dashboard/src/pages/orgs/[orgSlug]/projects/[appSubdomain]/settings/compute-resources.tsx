import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
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
        <ProjectViewWithState>
          <SettingsLayout>{page}</SettingsLayout>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
