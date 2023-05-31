import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { PermissionVariableSettings } from '@/features/projects/permissions/settings/components/PermissionVariableSettings';
import { RoleSettings } from '@/features/projects/roles/settings/components/RoleSettings';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
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
      <RoleSettings />
      <PermissionVariableSettings />
    </Container>
  );
}

RolesAndPermissionsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
