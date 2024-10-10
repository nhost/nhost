import { Container } from '@/components/layout/Container';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { BaseDirectorySettings } from '@/features/projects/git/settings/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/projects/git/settings/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/projects/git/settings/components/GitConnectionSettings';
import type { ReactElement } from 'react';

export default function GitSettingsPage() {
  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-y-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <GitConnectionSettings />
      <DeploymentBranchSettings />
      <BaseDirectorySettings />
    </Container>
  );
}

GitSettingsPage.getLayout = function getLayout(page: ReactElement) {
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
