import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { PermissionVariableSettings } from '@/features/projects/permissions/settings/components/PermissionVariableSettings';
import { RoleSettings } from '@/features/projects/roles/settings/components/RoleSettings';
import { useLocalMimirClient } from '@/hooks/useLocalMimirClient';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';

export default function RolesAndPermissionsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { loading, error } = useGetRolesPermissionsQuery({
    variables: {
      appId: currentProject?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
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
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
