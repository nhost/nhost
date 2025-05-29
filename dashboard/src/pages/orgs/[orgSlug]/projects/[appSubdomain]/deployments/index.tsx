import { useUI } from '@/components/common/UIProvider';
import { ContainerV2 } from '@/components/layout/Container';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { Heading } from '@/components/ui/v3/heading';
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
      <ContainerV2 className="mt-12 grid max-w-3xl grid-flow-row gap-4 text-center font-[Inter] antialiased">
        <div className="mx-auto flex w-centImage flex-col text-center">
          <Image
            src="/assets/githubRepo.svg"
            width={72}
            height={72}
            alt="GitHub Logo"
          />
        </div>
        <div className="grid grid-flow-row gap-2">
          <Heading variant="h4">Deployments</Heading>
          <p>
            Once you connect this app to version control, all changes will be
            deployed automatically.
          </p>
        </div>

        <NavLink
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
          passHref
          legacyBehavior
        >
          <Button
            variant="ghost"
            className="mx-auto text-base font-medium text-[#3888FF] hover:bg-[#1B2534] hover:text-[#3888FF]"
            disabled={maintenanceActive}
          >
            Connect your Project to GitHub
          </Button>
        </NavLink>
      </ContainerV2>
    );
  }

  return (
    <ContainerV2 className="mx-auto flex max-w-5xl flex-col space-y-2 pt-8 font-[Inter]">
      <Heading variant="h3">Deployments</Heading>
      <RetryableErrorBoundary>
        <AppDeployments appId={project?.id} />
      </RetryableErrorBoundary>
    </ContainerV2>
  );
}

DeploymentsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
