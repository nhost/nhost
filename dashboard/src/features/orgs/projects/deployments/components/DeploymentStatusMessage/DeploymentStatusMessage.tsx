import { Avatar } from '@/components/ui/v1/Avatar';
import { Text } from '@/components/ui/v2/Text';
import type { Deployment } from '@/types/application';
import formatDistance from 'date-fns/formatDistance';

export interface DeploymentStatusMessageProps {
  /**
   * The deployment to render the status message for.
   */
  deployment: Partial<Deployment>;
  /**
   * The date the application was created.
   */
  appCreatedAt: string;
}

export default function DeploymentStatusMessage({
  deployment,
  appCreatedAt,
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
      <span className="flex flex-row">
        <Avatar
          component="span"
          name={deployment.commitUserName}
          avatarUrl={deployment.commitUserAvatarUrl}
          className="mr-1 h-4 w-4 self-center"
        />
        <Text component="span" className="self-center text-sm">
          {deployment.commitUserName} updated just now
        </Text>
      </span>
    );
  }

  if (!isDeployingToProduction && deployment?.deploymentEndedAt) {
    return (
      <span className="grid grid-flow-col">
        <Avatar
          component="span"
          name={deployment.commitUserName}
          avatarUrl={deployment.commitUserAvatarUrl}
          className="mr-1 h-4 w-4 self-center"
        />
        <Text component="span" className="self-center truncate text-sm">
          {deployment.commitUserName} deployed{' '}
          {formatDistance(new Date(deployment.deploymentEndedAt), new Date(), {
            addSuffix: true,
          })}
        </Text>
      </span>
    );
  }

  return (
    <Text component="span" className="text-sm">
      created{' '}
      {formatDistance(new Date(appCreatedAt), new Date(), {
        addSuffix: true,
      })}
    </Text>
  );
}
