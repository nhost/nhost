import AppDeploymentDuration from '@/components/deployments/AppDeploymentDuration';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useDeploymentSubSubscription } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import DelayedLoading from '@/ui/DelayedLoading';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import Box from '@/ui/v2/Box';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
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

  const { currentApplication } = useCurrentWorkspaceAndApplication();

  if (loading) {
    return (
      <Container>
        <DelayedLoading delay={500} />
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
        <h1 className="text-4xl font-semibold text">Not found</h1>
        <p className="text-sm text-greyscaleGrey">
          This deployment does not exist.
        </p>
      </Container>
    );
  }

  const showTime =
    !['SCHEDULED', 'PENDING'].includes(deployment.deploymentStatus) &&
    deployment.deploymentStartedAt;

  const relativeDateOfDeployment = showTime
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
      <div className="my-8 flex justify-between">
        <div className="grid grid-flow-col gap-4 items-center">
          <Avatar
            name={deployment.commitUserName}
            avatarUrl={deployment.commitUserAvatarUrl}
            className="h-8 w-8"
          />

          <div>
            <Text>{deployment.commitMessage}</Text>
            <Text sx={{ color: 'text.secondary' }}>
              {relativeDateOfDeployment}
            </Text>
          </div>
        </div>
        <div className=" flex items-center">
          <Link
            className="self-center font-mono font-medium"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${currentApplication.githubRepository?.fullName}/commit/${deployment.commitSHA}`}
            underline="hover"
          >
            {deployment.commitSHA.substring(0, 7)}
          </Link>

          {showTime && (
            <div className="w-20 text-right">
              <AppDeploymentDuration
                startedAt={deployment.deploymentStartedAt}
                endedAt={deployment.deploymentEndedAt}
              />
            </div>
          )}
        </div>
      </div>
      <div>
        <Box
          className="rounded-lg p-4 text-sm- text-white"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.100' : `grey.800`,
          }}
        >
          {deployment.deploymentLogs.length === 0 && (
            <span className="font-mono">No message.</span>
          )}

          {deployment.deploymentLogs.map((log) => (
            <div key={log.id} className="flex font-mono">
              <div className=" mr-2 flex-shrink-0">
                {format(parseISO(log.createdAt), 'KK:mm:ss')}:
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
