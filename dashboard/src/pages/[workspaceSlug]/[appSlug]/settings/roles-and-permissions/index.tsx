import Container from '@/components/layout/Container';
import PermissionVariableSettings from '@/components/settings/permissions/PermissionVariableSettings';
import RolesSettings from '@/components/settings/roles/RoleSettings';
import SettingsLayout from '@/components/settings/SettingsLayout';
import type { ReactElement } from 'react';

export default function RolesAndPermissionsPage() {
  return (
    <Container
      className="grid grid-flow-row gap-6 max-w-5xl bg-transparent"
      rootClassName="bg-transparent"
    >
      <RolesSettings />
      <PermissionVariableSettings />
    </Container>
  );
}

RolesAndPermissionsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
