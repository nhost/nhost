import { createFileRoute, useParams } from '@tanstack/react-router';
import DeploymentDetails from '@/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/deployments/$deploymentId',
)({
  component: DeploymentDetailsPage,
});

function DeploymentDetailsPage() {
  const { deploymentId } = useParams({ strict: false });
  return deploymentId && <DeploymentDetails />;
}
