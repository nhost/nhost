import { formatDistance } from 'date-fns';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Text } from '@/components/ui/v2/Text';
import { ifNullconvertToUndefined } from '@/lib/utils';
import type { PipelineRunInput } from '@/features/orgs/projects/deployments/types';
import type { PipelineRunRowFragment } from '@/utils/__generated__/graphql';

export interface DeploymentStatusMessageProps {
  pipelineRun: Partial<PipelineRunRowFragment>;
}

export default function DeploymentStatusMessage({
  pipelineRun,
}: DeploymentStatusMessageProps) {
  const input = pipelineRun?.input as PipelineRunInput | undefined;
  const isInProgress = ['pending', 'running'].includes(
    pipelineRun?.status as string,
  );

  if (isInProgress || (pipelineRun && !pipelineRun.endedAt)) {
    return (
      <span className="flex flex-row justify-start">
        <Avatar
          alt={`Avatar of ${input?.commit_user_name}`}
          src={ifNullconvertToUndefined(input?.commit_user_avatar_url)}
          className="mr-1 h-4 w-4 self-center"
        />
        <Text component="span" className="self-center text-sm">
          {input?.commit_user_name} updated just now
        </Text>
      </span>
    );
  }

  if (!isInProgress && pipelineRun?.endedAt) {
    const statusMessage = `deployed ${formatDistance(new Date(pipelineRun.endedAt), new Date(), { addSuffix: true })}`;

    return (
      <div className="relative flex flex-row">
        <Avatar
          alt={`Avatar of ${input?.commit_user_name}`}
          src={ifNullconvertToUndefined(input?.commit_user_avatar_url)}
          className="mt-1 mr-2 h-4 w-4"
        />
        <div className="flex flex-col text-muted-foreground text-sm">
          <p className="line-clamp-1 break-all">{input?.commit_user_name}</p>
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
