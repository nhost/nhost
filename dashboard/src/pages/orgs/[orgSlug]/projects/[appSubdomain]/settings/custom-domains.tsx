import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import {
  SettingsCard,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { RunServiceDomains } from '@/features/orgs/projects/custom-domains/settings/components/RunServiceDomains';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function CustomDomains() {
  const { org } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const { services, loading: loadingRunServices } = useRunServices();

  if (org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-custom-domains"
          title="To unlock Custom Domains, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  const isInitialLoading =
    loadingProject ||
    !project?.id ||
    (loadingRunServices && services.length === 0);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading custom domain settings...
      </Spinner>
    );
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <SettingsCard>
        <SettingsCardHeader
          title="Custom Domains"
          description="Add a custom domain to your Run services for only a $10 flat fee 🚀"
        />
        <SettingsCardFooter>
          <SettingsDocsLink
            href="https://docs.nhost.io/platform/cloud/custom-domains"
            title="Custom Domains"
          />
        </SettingsCardFooter>
      </SettingsCard>

      <RunServiceDomains services={services} />
    </div>
  );
}

CustomDomains.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </ProjectLayout>
  );
};
