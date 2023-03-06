import Container from '@/components/layout/Container';
import ResourcesForm from '@/components/settings/resources/ResourcesForm';
import SettingsLayout from '@/components/settings/SettingsLayout';
import type { ReactElement } from 'react';

export default function ResourceSettingsPage() {
  // const { currentApplication } = useCurrentWorkspaceAndApplication();

  // TODO: Enable this when the feature is ready
  // if (currentApplication.plan.isFree) {
  //   return (
  //     <UnlockFeatureByUpgrading
  //       message="Unlock SMTP settings by upgrading your project to the Pro plan."
  //       className="mt-4"
  //     />
  //   );
  // }

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
