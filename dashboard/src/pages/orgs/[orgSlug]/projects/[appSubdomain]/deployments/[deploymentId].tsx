import { ContainerV2 } from '@/components/layout/Container';
import type { DeploymentStatus } from '@/components/presentational/StatusCircle';
import { StatusCircle } from '@/components/presentational/StatusCircle';
import { Avatar, AvatarImage } from '@/components/ui/v3/avatar';
import { Heading } from '@/components/ui/v3/heading';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { DeploymentDurationLabel } from '@/features/orgs/projects/deployments/components/DeploymentDurationLabel';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useDeploymentSubSubscription } from '@/generated/graphql';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import Link from 'next/link';
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
      <ContainerV2 className="flex h-full w-full items-center justify-center">
        <Spinner>Loading deployment...</Spinner>
      </ContainerV2>
    );
  }

  if (error) {
    throw error;
  }

  const { deployment } = data;

  if (!deployment) {
    return (
      <ContainerV2 className="py-5">
        <Heading variant="h2" className="text-4xl font-semibold">
          Not found
        </Heading>
        <p
          className="text-disabled text-sm text-[#9CA7B7] dark:text-[#68717A]"
          color="disabled"
        >
          This deployment does not exist.
        </p>
      </ContainerV2>
    );
  }

  const relativeDateOfDeployment = deployment.deploymentStartedAt
    ? formatDistanceToNowStrict(parseISO(deployment.deploymentStartedAt), {
        addSuffix: true,
      })
    : '';

  return (
    <ContainerV2
      variant="fullMobileBreakpointPadded"
      className="py-5 font-[Inter]"
    >
      <div className="flex justify-between">
        <div>
          <Heading variant="h2">Deployment Details</Heading>
        </div>
        <div className="flex space-x-8">
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.migrationsStatus as DeploymentStatus}
            />

            <p>Database Migrations</p>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.metadataStatus as DeploymentStatus}
            />

            <p>Hasura Metadata</p>
          </div>
          <div className="flex items-center space-x-2">
            <StatusCircle
              status={deployment.functionsStatus as DeploymentStatus}
            />

            <p>Serverless Functions</p>
          </div>
        </div>
      </div>
      <div className="my-8 flex justify-between">
        <div className="grid grid-flow-col items-center gap-4">
          <Avatar className="h-8 w-8">
            <AvatarImage src={deployment.commitUserAvatarUrl} />
          </Avatar>
          <div>
            <p>{deployment.commitMessage}</p>
            <p className="text-[#A2B3BE]">{relativeDateOfDeployment}</p>
          </div>
        </div>
        <div className="flex items-center">
          <Link
            className="self-center font-mono text-[0.9375rem] font-medium leading-[1.375rem] text-[#0052cd] hover:underline dark:text-[#3888ff]"
            target="_blank"
            rel="noreferrer"
            href={`https://github.com/${project?.githubRepository?.fullName}/commit/${deployment?.commitSHA}`}
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
        <div className="rounded-lg bg-[#10151E] p-4 text-sm- text-white">
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
        </div>
      </div>
    </ContainerV2>
  );
}

DeploymentDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
