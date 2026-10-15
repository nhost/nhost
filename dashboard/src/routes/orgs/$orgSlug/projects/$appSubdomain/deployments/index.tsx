import { createFileRoute } from '@tanstack/react-router';
import { NavLink } from '@/components/common/NavLink';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { AppDeployments } from '@/features/orgs/projects/deployments/components/AppDeployments';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getSearchParam } from '@/lib/search-params';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/',
)({
  validateSearch: (search): { page?: string } => ({
    page: getSearchParam(search.page),
  }),
  component: DeploymentsPage,
});

function DeploymentsPage() {
  const { project } = useProject();

  if (!project?.githubRepository) {
    return (
      <Container className="grid max-w-3xl grid-flow-row gap-4 pt-8 pb-8 text-center antialiased">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <img
            src="/assets/githubRepo.svg"
            width={72}
            height={72}
            alt="GitHub Logo"
          />
        </div>
        <div className="grid grid-flow-row gap-2">
          <h1 className="font-medium text-lg">Deployments</h1>
          <p className="text-sm+">
            Once you connect this app to version control, all changes will be
            deployed automatically.
          </p>
        </div>
        <div className="flex w-full justify-center">
          <NavLink
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/deployments/settings"
            params
            underline="none"
            variant="ghost"
            className="!text-primary"
          >
            Connect your Project to GitHub
          </NavLink>
        </div>
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
