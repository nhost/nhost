import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { RedeployDialog } from '@/features/orgs/projects/deployments/components/RedeployDialog';
import { useRedeployDeployment } from '@/features/orgs/projects/deployments/hooks/useRedeployDeployment';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type UnifiedDeploymentRowFragment,
  useLatestLiveUnifiedDeploymentSubSubscription,
  usePendingOrRunningUnifiedDeploymentsSubSubscription,
} from '@/generated/graphql';

interface LoadedRedeployButtonProps {
  deployment: UnifiedDeploymentRowFragment;
  liveDeployment: UnifiedDeploymentRowFragment | null;
  inProgress: boolean;
}

function LoadedRedeployButton({
  deployment,
  liveDeployment,
  inProgress,
}: LoadedRedeployButtonProps) {
  const { redeploy, confirm, cancel, warning, scheduling } =
    useRedeployDeployment(deployment, liveDeployment);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              disabled={inProgress || scheduling}
              onClick={redeploy}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Redeploy
            </Button>
          </span>
        </TooltipTrigger>
        {inProgress && (
          <TooltipContent>
            Deployments cannot be re-triggered when a deployment is in progress.
          </TooltipContent>
        )}
      </Tooltip>
      {warning && liveDeployment && (
        <RedeployDialog
          deployment={deployment}
          liveDeployment={liveDeployment}
          warning={warning}
          inProgress={inProgress}
          scheduling={scheduling}
          onCancel={cancel}
          onConfirm={confirm}
        />
      )}
    </>
  );
}

export interface DeploymentRedeployButtonProps {
  deployment: UnifiedDeploymentRowFragment;
}

export default function DeploymentRedeployButton({
  deployment,
}: DeploymentRedeployButtonProps) {
  const { project } = useProject();
  const { data: liveData } = useLatestLiveUnifiedDeploymentSubSubscription({
    variables: { appId: project?.id },
    skip: !project,
  });
  const { data: pendingData } =
    usePendingOrRunningUnifiedDeploymentsSubSubscription({
      variables: { appId: project?.id },
      skip: !project,
    });
  // Without the live deployment we can't tell whether to warn, so wait for it.
  if (!liveData || !pendingData) {
    return (
      <Button variant="outline" disabled>
        <RotateCcw className="mr-2 h-4 w-4" />
        Redeploy
      </Button>
    );
  }

  return (
    <LoadedRedeployButton
      deployment={deployment}
      liveDeployment={liveData.unifiedDeployments[0] ?? null}
      inProgress={pendingData.unifiedDeployments.length > 0}
    />
  );
}
