import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';

export default function ResourceSettingsPage() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <Container
        className="grid grid-flow-row gap-6 bg-transparent"
        rootClassName="bg-transparent"
      >
        <UpgradeToProBanner
          section="compute-resources"
          title="To unlock Compute Resources, transfer this project to a Pro or Team organization."
          description=""
        />
      </Container>
    );
  }

  return <ResourcesForm />;
}

ResourceSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex w-full flex-auto flex-col',
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
    </OrgLayout>
  );
};
