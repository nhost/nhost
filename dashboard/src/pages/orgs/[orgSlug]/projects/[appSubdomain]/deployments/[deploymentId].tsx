import { Container } from '@/components/layout/Container';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar } from '@/components/ui/v1/Avatar';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useDeploymentSubSubscription } from '@/generated/graphql';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function DeploymentDetailsPage() {
  const {
    query: { deploymentId },
  } = useRouter();

  const { data, error, loading } = useDeploymentSubSubscription({
    variables: {
      id: deploymentId,
    },
  });

  const { project } = useProject();

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

  const { deployment } = data;

  if (!deployment) {
    return (
      <Container>
        <Text variant="h1" className="text-4xl font-semibold text">
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
      <div className="flex justify-between my-8">
        <div className="grid items-center grid-flow-col gap-4">
          <Avatar
            name={deployment.commitUserName}
            avatarUrl={deployment.commitUserAvatarUrl}
            className="w-8 h-8"
          />

          <div>
            <Text>{deployment.commitMessage}</Text>
            <Text color="secondary">{relativeDateOfDeployment}</Text>
          </div>
        </div>
        <div className="flex items-center">
          <Link
            className="self-center font-mono font-medium"
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
          className="p-4 rounded-lg text-sm-"
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
              <div className="flex-shrink-0 mr-2">
                {format(parseISO(log.createdAt), 'HH:mm:ss')}:
              </div>
              <div className="break-all">{log.message}</div>
            </div>
          ))}
        </Box>
      </div>
    </Container>
  );
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
