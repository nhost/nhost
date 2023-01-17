import AppDeploymentDuration from '@/components/deployments/AppDeploymentDuration';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useDeploymentSubSubscription } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Avatar } from '@/ui/Avatar';
import DelayedLoading from '@/ui/DelayedLoading';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import { Text } from '@/ui/Text';
import Link from '@/ui/v2/Link';
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
        <h1 className="text-4xl font-semibold text-greyscaleDark">Not found</h1>
        <p className="text-sm text-greyscaleGrey">
          This deployment does not exist.
        </p>
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
          <Text
            variant="heading"
            size="big"
            color="greyscaleDark"
            className="font-medium"
          >
            Deployment Details
          </Text>
        </div>
        <div className="flex space-x-8">
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.migrationsStatus as DeploymentStatus}
            />
            <Text color="greyscaleDark" size="normal">
              Database Migrations
            </Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.metadataStatus as DeploymentStatus}
            />
            <Text color="greyscaleDark" size="normal">
              Hasura Metadata
            </Text>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.functionsStatus as DeploymentStatus}
            />
            <Text color="greyscaleDark" size="normal">
              Serverless Functions
            </Text>
          </div>
        </div>
      </div>
      <div className="my-8 flex justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <Avatar
              name={deployment.commitUserName}
              avatarUrl={deployment.commitUserAvatarUrl}
              className="h-8 w-8"
            />
          </div>
          <div>
            <div className="text-sm+ font-normal text-greyscaleDark">
              {deployment.commitMessage}
            </div>
            <div className="text-sm+ text-greyscaleGrey">
              {relativeDateOfDeployment}
            </div>
          </div>
        </div>
        <div className=" flex items-center">
          <Link
            className="self-center font-mono text-sm- font-medium"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${currentApplication.githubRepository?.fullName}/commit/${deployment.commitSHA}`}
            underline="hover"
          >
            {deployment.commitSHA.substring(0, 7)}
          </Link>

          <div className="w-20 text-right">
            <AppDeploymentDuration
              startedAt={deployment.deploymentStartedAt}
              endedAt={deployment.deploymentEndedAt}
            />
          </div>
        </div>
      </div>
      <div>
        <div className="rounded-lg bg-verydark p-4 text-sm- text-white">
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
        </div>
      </div>
    </Container>
  );
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
