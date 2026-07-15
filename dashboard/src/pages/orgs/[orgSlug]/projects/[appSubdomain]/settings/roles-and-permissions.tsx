import type { ReactElement } from 'react';
import { Container } from '@/components/layout/Container';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { PermissionVariableSettings } from '@/features/orgs/projects/permissions/settings/components/PermissionVariableSettings';
import { RoleSettings } from '@/features/orgs/projects/roles/settings/components/RoleSettings';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';

export default function RolesAndPermissionsPage() {
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error } = useGetRolesPermissionsQuery({
    variables: {
      appId: project?.id,
    },
    fetchPolicy: 'cache-and-network',
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading roles and permission variables...
      </Spinner>
    );
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
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full overflow-auto',
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
