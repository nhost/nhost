import { Avatar } from '@/components/ui/v2/Avatar';
import { Text } from '@/components/ui/v2/Text';
import type { Deployment } from '@/types/application';
import formatDistance from 'date-fns/formatDistance';

export interface DeploymentStatusMessageProps {
  deployment: Partial<Deployment>;
}

export default function DeploymentStatusMessage({
  deployment,
}: DeploymentStatusMessageProps) {
  const isDeployingToProduction = [
    'SCHEDULED',
    'PENDING',
    'DEPLOYING',
  ].includes(deployment?.deploymentStatus);

  if (
    isDeployingToProduction ||
    (deployment && !deployment.deploymentEndedAt)
  ) {
    return (
      <span className="flex flex-row justify-start">
        <Avatar
          alt={`Avatar of ${deployment.commitUserName}`}
          src={deployment.commitUserAvatarUrl}
          className="mr-1 h-4 w-4 self-center"
        />
        <Text component="span" className="self-center text-sm">
          {deployment.commitUserName} updated just now
        </Text>
      </span>
    );
  }

  if (!isDeployingToProduction && deployment?.deploymentEndedAt) {
    const statusMessage = `deployed ${formatDistance(new Date(deployment.deploymentEndedAt), new Date(), { addSuffix: true })}`;

    return (
      <div className="relative flex flex-row">
        <Avatar
          alt={`Avatar of ${deployment.commitUserName}`}
          src={deployment.commitUserAvatarUrl}
          className="mr-2 mt-1 h-4 w-4"
        />
        <div className="flex flex-col text-sm text-muted-foreground">
          <p className="line-clamp-1 break-all">{deployment.commitUserName}</p>
          <p>{statusMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <Text component="span" className="text-sm text-muted-foreground">
      No deployments
    </Text>
  );
}
