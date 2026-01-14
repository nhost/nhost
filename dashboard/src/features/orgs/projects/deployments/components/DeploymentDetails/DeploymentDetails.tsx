import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Container } from '@/components/layout/Container';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Avatar } from '@/components/ui/v2/Avatar';
import { Box } from '@/components/ui/v2/Box';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { DeploymentServiceLogs } from '@/features/orgs/projects/deployments/components/DeploymentServiceLogs';
import { useDeployment } from '@/features/orgs/projects/deployments/hooks/useDeployment';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ifNullconvertToUndefined, isNotEmptyValue } from '@/lib/utils';

function DeploymentDetails() {
  const { project } = useProject();

  const { data, error, loading } = useDeployment();

  const deploymentLogsFrom = data?.deployment?.deploymentLogs[0]?.createdAt;
  const deploymentLogsTo =
    data?.deployment?.deploymentEndedAt &&
    isNotEmptyValue(data?.deployment.deploymentLogs)
      ? data?.deployment.deploymentLogs.slice(-1)[0]?.createdAt
      : null;

  if (loading) {
    return (
      <Container>
        <ActivityIndicator delay={500} label="Loading deployment..." />
      </Container>
    );
  }

  if (error) {
    throw error;
  }

  const { deployment } = data || {};

  if (!deployment) {
    return (
      <Container>
        <Text variant="h1" className="text font-semibold text-4xl">
          Not found
        </Text>
        <Text className="text-sm" color="disabled">
          This deployment does not exist.
        </Text>
      </Container>
    );
  }

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  const showLogs =
    project?.id && deployment && isNotEmptyValue(deployment.deploymentLogs);

  return (
    <Container>
      <div className="flex justify-between">
        <div>
          <Text variant="h2" component="h1">
            Deployment Details
          </Text>
        </div>
        <div className="flex space-x-8">
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.migrationsStatus as DeploymentStatus}
            />

            <Text>Database Migrations</Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.metadataStatus as DeploymentStatus}
            />

            <Text>Hasura Metadata</Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.functionsStatus as DeploymentStatus}
            />

            <Text>Serverless Functions</Text>
          </div>
        </div>
      </div>
      <div className="my-8 flex justify-between">
        <div className="grid grid-flow-col items-center gap-4">
          <Avatar
            alt={ifNullconvertToUndefined(deployment.commitUserName)}
            src={ifNullconvertToUndefined(deployment.commitUserAvatarUrl)}
            className="say what??? h-8 w-8"
          >
            {deployment.commitUserName!}
          </Avatar>

          <div>
            <Text>{deployment.commitMessage}</Text>
            <Text color="secondary">{relativeDateOfDeployment}</Text>
          </div>
        </div>
        <div className="flex items-center">
          <Link
            className="self-center font-medium font-mono"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${project?.githubRepository?.fullName}/commit/${deployment?.commitSHA}`}
            underline="hover"
          >
            {deployment.commitSHA.substring(0, 7)}
          </Link>

          <div className="w-20 text-right">
            <DeploymentDurationLabel
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>
        </div>
      </div>
      <div>
        <Box
          className="rounded-lg p-4 text-sm-"
          sx={{
            color: 'common.white',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.100' : 'grey.800',
          }}
        >
          {deployment.deploymentLogs.length === 0 && (
            <span className="font-mono">No message.</span>
          )}

          {deployment.deploymentLogs.map((log) => (
            <div key={log.id} className="flex font-mono">
              <div className="mr-2 flex-shrink-0">
                {format(parseISO(log.createdAt), 'HH:mm:ss')}:
              </div>
              <div className="break-all">{log.message}</div>
            </div>
          ))}
        </Box>
      </div>
      {showLogs && (
        <DeploymentServiceLogs
          from={deploymentLogsFrom}
          to={deploymentLogsTo}
        />
      )}
    </Container>
  );
}

export default DeploymentDetails;
