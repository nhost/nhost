import { TriangleAlert } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { LatestDeployment } from '@/features/orgs/components/projects/utils/getLatestDeployment';
import { PipelineRunStatus_Enum } from '@/generated/graphql';

const MESSAGE = 'The last deployment failed';

interface DeploymentFailedWarningProps {
  latest: LatestDeployment;
}

export default function DeploymentFailedWarning({
  latest,
}: DeploymentFailedWarningProps) {
  const failed = latest.pipelineRun
    ? latest.pipelineRun.status === PipelineRunStatus_Enum.Failed
    : latest.deployment?.deploymentStatus === 'FAILED';

  if (!failed) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TriangleAlert
          aria-label={MESSAGE}
          className="relative z-20 ml-auto h-4 w-4 flex-shrink-0 text-warning"
        />
      </TooltipTrigger>
      <TooltipContent>{MESSAGE}</TooltipContent>
    </Tooltip>
  );
}
