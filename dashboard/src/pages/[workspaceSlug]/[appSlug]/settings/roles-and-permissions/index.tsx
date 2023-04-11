import Container from '@/components/layout/Container';
import PermissionVariableSettings from '@/components/settings/permissions/PermissionVariableSettings';
import RolesSettings from '@/components/settings/roles/RoleSettings';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function RolesAndPermissionsPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { loading, error } = useGetRolesPermissionsQuery({
    variables: {
      appId: currentProject?.id,
    },
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading roles and permission variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
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
