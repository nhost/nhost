import Container from '@/components/layout/Container';
import DefaultAllowedRoleSettings from '@/components/settings/defaultAllowedRoles/DefaultAllowedRoleSettings';
import DefaultRoleSettings from '@/components/settings/defaultRole/DefaultRoleSettings';
import PermissionVariableSettings from '@/components/settings/permissions/PermissionVariableSettings';
import RolesSettings from '@/components/settings/roles/RoleSettings';
import SettingsLayout from '@/components/settings/SettingsLayout';
import type { ReactElement } from 'react';

export default function RolesAndPermissionsPage() {
  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <RolesSettings />
      <DefaultRoleSettings />
      <DefaultAllowedRoleSettings />
      <PermissionVariableSettings />
    </Container>
  );
}

RolesAndPermissionsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
