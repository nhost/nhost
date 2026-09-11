import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';
import { DeploymentsArea } from '@/features/orgs/projects/deployments/layout';

export default function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();
  return deploymentId && <DeploymentDetails />;
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DeploymentsArea>{page}</DeploymentsArea>
      </ProjectScope>
    </AppLayout>
  );
};
