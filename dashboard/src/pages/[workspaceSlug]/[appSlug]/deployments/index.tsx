import AppDeployments from '@/components/applications/AppDeployments';
import useGitHubModal from '@/components/applications/github/useGitHubModal';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import Image from 'next/image';
import type { ReactElement } from 'react';

export default function DeploymentsPage() {
  const { workspaceContext } = useWorkspaceContext();
  const { openGitHubModal } = useGitHubModal();

  if (!workspaceContext.repository) {
    return (
      <Container className="mt-12 max-w-3xl text-center antialiased">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/githubRepo.svg"
            width={72}
            height={72}
            alt="GitHub Logo"
          />
        </div>
        <Text className="mt-4 font-medium" size="large" color="dark">
          Deployments
        </Text>
        <Text size="normal" color="greyscaleDark" className="mt-1 transform">
          Once you connect this app to version control, all changes will be
          deployed automatically.
        </Text>
        <div className="mt-3 flex text-center">
          <Button
            transparent
            color="blue"
            className="mx-auto font-medium"
            onClick={openGitHubModal}
          >
            Connect your Project to GitHub
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mx-auto flex max-w-5xl flex-col space-y-2">
      <div className="mt-4 flex flex-row place-content-between">
        <Text color="greyscaleDark" size="big" className="font-medium">
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
