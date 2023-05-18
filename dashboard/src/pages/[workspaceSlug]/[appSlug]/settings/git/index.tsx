import Container from '@/components/layout/Container';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { BaseDirectorySettings } from '@/features/projects/settings/git/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/projects/settings/git/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/projects/settings/git/components/GitConnectionSettings';
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
  return <SettingsLayout>{page}</SettingsLayout>;
};
