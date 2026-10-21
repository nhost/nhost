import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { RocketIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { NavLink } from '@/components/common/NavLink';
import { AppLayout } from '@/components/layout/AppLayout';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { AppDeployments } from '@/features/orgs/projects/deployments/components/AppDeployments';
import { DeploymentsArea } from '@/features/orgs/projects/deployments/layout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DeploymentsPage() {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  if (!project?.githubRepository) {
    return (
      <Container
        className="flex h-full max-w-3xl flex-col pt-8 pb-8"
        rootClassName="h-full"
      >
        <EmptyState
          icon={RocketIcon}
          title="Deployments"
          description="Once you connect this app to version control, all changes will be deployed automatically."
          action={
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
              underline="none"
              variant="default"
              className="h-9"
            >
              <GitHubIcon className="mr-1.5 h-4 w-4 self-center" />
              Connect your Project to GitHub
            </NavLink>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="mx-auto flex max-w-5xl flex-col space-y-2 pt-8 pb-8">
      <div className="flex flex-row place-content-between">
        <h1 className="font-medium text-2xl">Deployments</h1>
      </div>

      <RetryableErrorBoundary>
        <AppDeployments appId={project?.id} />
      </RetryableErrorBoundary>
    </Container>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DeploymentsArea>{page}</DeploymentsArea>
      </ProjectScope>
    </AppLayout>
  );
};
