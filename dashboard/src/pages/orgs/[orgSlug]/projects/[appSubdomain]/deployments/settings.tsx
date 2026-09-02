import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { getDeploymentsLayout } from '@/features/orgs/projects/deployments/layout';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { AutomaticDeploysSettings } from '@/features/orgs/projects/git/settings/components/AutomaticDeploysSettings';
import { BaseDirectorySettings } from '@/features/orgs/projects/git/settings/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/orgs/projects/git/settings/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/orgs/projects/git/settings/components/GitConnectionSettings';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';

export default function DeploymentsSettingsPage() {
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
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <div className="grid grid-flow-row gap-y-6">
          <GitConnectionSettings />
          <AutomaticDeploysSettings />
          <DeploymentBranchSettings />
          <BaseDirectorySettings />
        </div>
      </div>
    </SettingsLayout>
  );
}

DeploymentsSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getDeploymentsLayout(page, {
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
