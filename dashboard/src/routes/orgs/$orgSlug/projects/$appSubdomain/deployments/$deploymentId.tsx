import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/router';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/$deploymentId',
)({
  component: DeploymentDetailsPage,
});

function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();
  return deploymentId && <DeploymentDetails />;
}
