import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';

export default function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();
  return deploymentId && <DeploymentDetails />;
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
