import { useUI } from '@/components/common/UIProvider';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { AppDeployments } from '@/features/orgs/projects/deployments/components/AppDeployments';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';

export default function DeploymentsPage() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { maintenanceActive } = useUI();

  if (!project?.githubRepository) {
    return (
      <Container className="grid max-w-3xl grid-flow-row gap-4 mt-12 antialiased text-center">
        <div className="flex flex-col mx-auto text-center w-centImage">
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
          href={`/orgs/${org?.slug}/projects/${project?.slug}/settings/git`}
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
    <Container className="flex flex-col max-w-5xl mx-auto space-y-2">
      <div className="flex flex-row mt-4 place-content-between">
        <Text variant="h2" component="h1">
          Deployments
        </Text>
      </div>

      <RetryableErrorBoundary>
        <AppDeployments appId={project?.id} />
      </RetryableErrorBoundary>
    </Container>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
