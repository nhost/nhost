import AppDeployments from '@/components/applications/AppDeployments';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';

export default function DeploymentsPage() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const { workspaceContext } = useWorkspaceContext();

  if (!workspaceContext.repository) {
    return (
      <Container className="mt-12 max-w-3xl text-center antialiased grid grid-flow-row gap-4">
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
          href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/git`}
          passHref
        >
          <Button variant="borderless" className="mx-auto font-medium">
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
        <AppDeployments appId={workspaceContext.appId} />
      </RetryableErrorBoundary>
    </Container>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
