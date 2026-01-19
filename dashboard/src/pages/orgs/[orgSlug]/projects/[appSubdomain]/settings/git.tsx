import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { Container } from '@/components/layout/Container';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { BaseDirectorySettings } from '@/features/orgs/projects/git/settings/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/orgs/projects/git/settings/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/orgs/projects/git/settings/components/GitConnectionSettings';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';

export default function GitSettingsPage() {
  const router = useRouter();
  const { isReady: isRouterReady } = router;
  const { 'github-modal': githubModal } = router.query;
  const { openGitHubModal } = useGitHubModal();

  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  useEffect(() => {
    if (!isRouterReady) {
      return;
    }

    if (typeof githubModal === 'string') {
      removeQueryParamsFromUrl('github-modal');

      openGitHubModal();
    }
  }, [githubModal, isRouterReady, openGitHubModal, removeQueryParamsFromUrl]);

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
