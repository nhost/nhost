import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';

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
        <ProjectStateGate>{page}</ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
