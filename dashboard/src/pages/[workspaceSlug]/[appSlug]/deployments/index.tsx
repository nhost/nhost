import { useUI } from '@/components/common/UIProvider';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { AppDeployments } from '@/features/projects/deployments/components/AppDeployments';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';

export default function DeploymentsPage() {
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const { maintenanceActive } = useUI();

  if (!currentProject?.githubRepository) {
    return (
      <Container className="mt-12 grid max-w-3xl grid-flow-row gap-4 text-center antialiased">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/githubRepo.svg"
            width={72}
            height={72}
            alt="GitHub Logo"
          />
        </div>
        <div className="grid grid-flow-row gap-2">
          <Text variant="h3" component="h1">
            Deployments
          </Text>
          <Text>
            Once you connect this app to version control, all changes will be
            deployed automatically.
          </Text>
        </div>

        <NavLink
          href={`/${currentWorkspace?.slug}/${currentProject?.slug}/settings/git`}
          passHref
          legacyBehavior
        >
          <Button
            variant="borderless"
            className="mx-auto font-medium"
            disabled={maintenanceActive}
          >
            Connect your Project to GitHub
          </Button>
        </NavLink>
      </Container>
    );
  }

  return (
    <Container className="mx-auto flex max-w-5xl flex-col space-y-2">
      <div className="mt-4 flex flex-row place-content-between">
        <Text variant="h2" component="h1">
          Deployments
        </Text>
      </div>

      <RetryableErrorBoundary>
        <AppDeployments appId={currentProject?.id} />
      </RetryableErrorBoundary>
    </Container>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
