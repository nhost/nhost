import { formatDistance } from 'date-fns';
import { Avatar } from '@/components/ui/v3/avatar';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import type {
  DeploymentRowFragment,
  PipelineRunRowFragment,
} from '@/generated/graphql';

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

  // Both branches below share the same soft, padded container: it's what
  // visually separates the deployment info from the project name/region
  // text sitting right above it in the card, rather than everything
  // running together as plain text.
  //
  // bg-secondary-200 rather than bg-muted/40: --muted is 98% lightness in
  // light mode (near white, same as the card background), so at 40% alpha
  // it was essentially invisible there even though it read fine in dark
  // mode. secondary-200 has real contrast against the card in both themes
  // (92.4% light / 17.5% dark) without introducing a new one-off color.
  if (isInProgress || (hasData && !endedAt)) {
    return (
      <div className="flex w-full flex-row items-center gap-2 rounded-md bg-secondary-200 px-2.5 py-2">
        <Avatar
          alt={`Avatar of ${userName}`}
          name={userName ?? undefined}
          src={avatarUrl}
          className="h-4 w-4 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate text-sm">
          {userName} updated just now
        </span>
      </div>
    );
  }

  if (!isInProgress && endedAt) {
    const statusMessage = `deployed ${formatDistance(new Date(endedAt), new Date(), { addSuffix: true })}`;

    return (
      <div className="flex w-full flex-row items-center gap-2 rounded-md bg-secondary-200 px-2.5 py-2">
        <Avatar
          alt={`Avatar of ${userName}`}
          name={userName ?? undefined}
          src={avatarUrl}
          className="h-4 w-4 shrink-0"
        />
        {/* Username and "deployed X ago" on one line (was stacked on two):
            the taller two-line version pushed the Live status pill further
            down toward the bottom edge of the fixed-height card. */}
        <p className="min-w-0 flex-1 truncate text-sm">
          <span>{userName}</span>{' '}
          <span className="text-muted-foreground">· {statusMessage}</span>
        </p>
      </div>
    );
  }

  return null;
}
