import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';

export default function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();
  return deploymentId && <DeploymentDetails />;
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
