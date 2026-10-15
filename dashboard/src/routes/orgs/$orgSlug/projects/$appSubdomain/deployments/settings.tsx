import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { useGitHubModal } from '@/features/orgs/projects/git/common/hooks/useGitHubModal';
import { AutomaticDeploysSettings } from '@/features/orgs/projects/git/settings/components/AutomaticDeploysSettings';
import { BaseDirectorySettings } from '@/features/orgs/projects/git/settings/components/BaseDirectorySettings';
import { DeploymentBranchSettings } from '@/features/orgs/projects/git/settings/components/DeploymentBranchSettings';
import { GitConnectionSettings } from '@/features/orgs/projects/git/settings/components/GitConnectionSettings';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/settings',
)({
  component: RouteComponent,
});

function DeploymentsSettingsPage() {
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
    <div className="grid grid-flow-row gap-y-6">
      <GitConnectionSettings />
      <AutomaticDeploysSettings />
      <DeploymentBranchSettings />
      <BaseDirectorySettings />
    </div>
  );
}

function RouteComponent() {
  return (
    <SettingsGuard>
      <SettingsArea>
        <DeploymentsSettingsPage />
      </SettingsArea>
    </SettingsGuard>
  );
}
