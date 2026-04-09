import { formatDistance } from 'date-fns';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Text } from '@/components/ui/v2/Text';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import { ifNullconvertToUndefined } from '@/lib/utils';
import type {
  DeploymentRowFragment,
  PipelineRunRowFragment,
} from '@/utils/__generated__/graphql';

export interface DeploymentStatusMessageProps {
  pipelineRun?: Partial<PipelineRunRowFragment>;
  // Legacy deployment (deprecated)
  deployment?: Partial<DeploymentRowFragment>;
}

export default function DeploymentStatusMessage({
  pipelineRun,
  deployment,
}: DeploymentStatusMessageProps) {
  // Normalize both types into a common shape for display
  let userName: string | undefined | null;
  let avatarUrl: string | undefined | null;
  let endedAt: string | undefined | null;
  let isInProgress = false;

  if (pipelineRun) {
    const input = pipelineRun.input as PipelineRunInput | undefined;
    userName = input?.commit_user_name;
    avatarUrl = input?.commit_user_avatar_url;
    endedAt = pipelineRun.endedAt;
    isInProgress = ['pending', 'running'].includes(
      pipelineRun.status as string,
    );
  } else if (deployment) {
    userName = deployment.commitUserName;
    avatarUrl = deployment.commitUserAvatarUrl;
    endedAt = deployment.deploymentEndedAt;
    isInProgress = ['SCHEDULED', 'PENDING', 'DEPLOYING'].includes(
      deployment.deploymentStatus as string,
    );
  }

  const hasData = pipelineRun || deployment;

  if (isInProgress || (hasData && !endedAt)) {
    return (
      <span className="flex flex-row justify-start">
        <Avatar
          alt={`Avatar of ${userName}`}
          src={ifNullconvertToUndefined(avatarUrl)}
          className="mr-1 h-4 w-4 self-center"
        />
        <Text component="span" className="self-center text-sm">
          {userName} updated just now
        </Text>
      </span>
    );
  }

  if (!isInProgress && endedAt) {
    const statusMessage = `deployed ${formatDistance(new Date(endedAt), new Date(), { addSuffix: true })}`;

    return (
      <div className="relative flex flex-row">
        <Avatar
          alt={`Avatar of ${userName}`}
          src={ifNullconvertToUndefined(avatarUrl)}
          className="mt-1 mr-2 h-4 w-4"
        />
        <div className="flex flex-col text-muted-foreground text-sm">
          <p className="line-clamp-1 break-all">{userName}</p>
          <p>{statusMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <Text component="span" className="text-muted-foreground text-sm">
      No deployments
    </Text>
  );
}
