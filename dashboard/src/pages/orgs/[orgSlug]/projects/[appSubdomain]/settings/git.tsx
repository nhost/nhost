import { Container } from '@/components/layout/Container';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { BaseDirectorySettings } from '@/features/orgs/projects/git/settings/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/orgs/projects/git/settings/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/orgs/projects/git/settings/components/GitConnectionSettings';
import { useRouter } from 'next/router';
import { useCallback, useEffect, type ReactElement } from 'react';

export default function GitSettingsPage() {
  const router = useRouter();
  const { 'github-modal': githubModal, ...remainingQuery } = router.query;
  const { openGitHubModal } = useGitHubModal();

  const removeQueryParamsFromURL = useCallback(() => {
    router.replace(
      { pathname: router.pathname, query: remainingQuery },
      undefined,
      {
        shallow: true,
      },
    );
  }, [router.replace, remainingQuery, router.pathname]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    if (typeof githubModal === 'string') {
      removeQueryParamsFromURL();

      openGitHubModal();
    }
  }, [githubModal, openGitHubModal]);

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
