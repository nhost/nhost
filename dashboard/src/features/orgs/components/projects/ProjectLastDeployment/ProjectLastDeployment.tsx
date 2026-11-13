import type { LatestDeployment } from '@/features/orgs/components/projects/utils/getLatestDeployment';
import { DeploymentStatusMessage } from '@/features/orgs/projects/deployments/components/DeploymentStatusMessage';

interface ProjectLastDeploymentProps {
  latest: LatestDeployment;
}

export default function ProjectLastDeployment({
  latest,
}: ProjectLastDeploymentProps) {
  return (
    <DeploymentStatusMessage
      pipelineRun={latest.pipelineRun}
      deployment={latest.deployment}
    />
  );
}
