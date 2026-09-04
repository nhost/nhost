import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';
import { getDeploymentsLayout } from '@/features/orgs/projects/deployments/layout';

export default function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();
  return deploymentId && <DeploymentDetails />;
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return getDeploymentsLayout(page);
};
