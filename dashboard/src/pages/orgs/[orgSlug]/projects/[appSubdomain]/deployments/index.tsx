import Image from 'next/image';
import type { ReactElement } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { useUI } from '@/components/common/UIProvider';
import { Container } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Text } from '@/components/ui/v2/Text';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { AppDeployments } from '@/features/orgs/projects/deployments/components/AppDeployments';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DeploymentsPage() {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { maintenanceActive } = useUI();

  if (!project?.githubRepository) {
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
        <div className="flex w-full justify-center">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            underline="none"
            variant="ghost"
            className="!text-primary"
            disabled={maintenanceActive}
          >
            Connect your Project to GitHub
          </NavLink>
        </div>
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
        <AppDeployments appId={project?.id} />
      </RetryableErrorBoundary>
    </Container>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
