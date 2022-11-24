import Container from '@/components/layout/Container';
import RolesSettings from '@/components/settings/rolesAndPermissions/RolesSettings/RolesSettings';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import type { ReactElement } from 'react';

export default function RolesAndPermissionsPage() {
  return (
    <Container
      className="grid grid-flow-row gap-6 max-w-5xl bg-transparent"
      rootClassName="bg-transparent"
    >
      <RolesSettings />

      <SettingsContainer
        title="Permission Variables"
        description="These variables can be used to defined permissions. They are sent from client to the GraphQL API, and must match the specified property of a queried user."
      >
        Hello
      </SettingsContainer>
    </Container>
  );
}

RolesAndPermissionsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
