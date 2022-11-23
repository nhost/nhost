import { FindOldApps } from '@/components/home';
import type { UserData } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import type { Application, ApplicationState } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { Avatar } from '@/ui/Avatar';
import StateBadge from '@/ui/StateBadge';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import { Text } from '@/ui/Text';
import { getApplicationStatusString } from '@/utils/helpers';
import { formatDistance } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { ContainerAllWorkspacesApplications } from './ContainerAllWorkspacesApplications';

function ApplicationCreatedAt({ createdAt }: any) {
  return (
    <Text color="dark" className="cursor-pointer self-center text-sm">
      created{' '}
      {formatDistance(new Date(createdAt), new Date(), {
        addSuffix: true,
      })}
    </Text>
  );
}

function LastSuccesfulDeployment({ deployment }: any) {
  return (
    <div className="flex flex-row">
      <Avatar
        name={deployment.commitUserName}
        avatarUrl={deployment.commitUserAvatarUrl}
        className="mr-1 h-4 w-4 self-center"
      />
      <Text color="dark" className="cursor-pointer self-center text-sm">
        {deployment.commitUserName} deployed{' '}
        {formatDistance(new Date(deployment.deploymentEndedAt), new Date(), {
          addSuffix: true,
        })}
      </Text>
    </div>
  );
}

function CurrentDeployment({ deployment }: any) {
  return (
    <div className="flex flex-row">
      <Avatar
        name={deployment.commitUserName}
        avatarUrl={deployment.commitUserAvatarUrl}
        className="mr-1 h-4 w-4 self-center"
      />
      <Text color="dark" className="cursor-pointer self-center text-sm">
        {deployment.commitUserName} updated just now
      </Text>
    </div>
  );
}

export function checkStatusOfTheApplication(
  stateHistory: ApplicationState[] | [],
) {
  if (stateHistory.length === 0) {
    return ApplicationStatus.Empty;
  }

  if (stateHistory[0].stateId === undefined) {
    return ApplicationStatus.Empty;
  }

  return stateHistory[0].stateId;
}

export function RenderWorkspacesWithApps({
  userData,
  query,
}: {
  userData: UserData | null;
  query: string;
}) {
  return (
    <div>
      {userData?.workspaces
        .filter((workspace) =>
          workspace.applications.map((app) =>
            app.name.toLowerCase().includes(query.toLowerCase()),
          ),
        )
        .sort((w1, w2) =>
          // sort alphabetical order (A-Z)
          w1.name.localeCompare(w2.name),
        )
        .map((workspace) => {
          // early exit if no applications are available
          if (workspace.applications.length === 0) {
            return null;
          }

          return (
            <div key={workspace.slug} className="my-8">
              <Link href={`/${workspace.slug}`}>
                <Text
                  variant="a"
                  color="greyscaleGrey"
                  size="normal"
                  className="mb-3 cursor-pointer font-medium"
                >
                  {workspace.name}
                </Text>
              </Link>
              <ContainerAllWorkspacesApplications>
                {workspace.applications
                  .filter((app: Application) =>
                    app.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .sort((appA, appB) => {
                    // sort apps based on either:
                    // 1. When the app was recently deployed, if there is any deployments available
                    // 2. When the app was created

                    const appASort =
                      appA.deployments.length > 0
                        ? new Date(appA.deployments[0].deploymentEndedAt)
                        : new Date(appA.createdAt);

                    const appBSort =
                      appB.deployments.length > 0
                        ? new Date(appB.deployments[0].deploymentEndedAt)
                        : new Date(appB.createdAt);

                    if (appASort > appBSort) {
                      return -1;
                    }
                    return 1;
                  })
                  .map((app) => {
                    const isDeployingToProduction = app.deployments[0]
                      ? app.deployments[0].deploymentStatus === 'DEPLOYING'
                      : false;
                    return (
                      <div key={app.slug} className="cursor-pointer py-4">
                        <Link href={`${workspace?.slug}/${app.slug}`} passHref>
                          <a
                            href={`${workspace?.slug}/${app.slug}`}
                            className="flex place-content-between rounded-sm border-divide bg-white px-2"
                          >
                            <div className="flex w-full flex-col self-center">
                              <div className="flex w-full flex-row place-content-between">
                                <div className="flex flex-row items-center self-center">
                                  <div className="h-10 w-10 overflow-hidden rounded-lg">
                                    <Image
                                      src="/logos/new.svg"
                                      alt="Nhost Logo"
                                      width={40}
                                      height={40}
                                    />
                                  </div>
                                  <div className="ml-2 flex flex-col text-left">
                                    <div>
                                      <Text
                                        color="dark"
                                        size="normal"
                                        className="cursor-pointer self-center text-left font-medium capitalize"
                                      >
                                        {app.name}
                                      </Text>
                                    </div>
                                    <div>
                                      {isDeployingToProduction && (
                                        <CurrentDeployment
                                          deployment={app.deployments[0]}
                                        />
                                      )}

                                      {!isDeployingToProduction &&
                                        app.deployments[0] && (
                                          <LastSuccesfulDeployment
                                            deployment={app.deployments[0]}
                                          />
                                        )}

                                      {!isDeployingToProduction &&
                                        !app.deployments[0] && (
                                          <ApplicationCreatedAt
                                            createdAt={app.createdAt}
                                          />
                                        )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-row">
                                  <div className="flex self-center align-middle">
                                    {app.deployments[0] && (
                                      <div className="mr-2 flex self-center align-middle">
                                        <StatusCircle
                                          status={
                                            app.deployments[0]
                                              .deploymentStatus as DeploymentStatus
                                          }
                                        />
                                      </div>
                                    )}
                                    <StateBadge
                                      status={checkStatusOfTheApplication(
                                        app.appStates,
                                      )}
                                      title={getApplicationStatusString(
                                        checkStatusOfTheApplication(
                                          app.appStates,
                                        ),
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </a>
                        </Link>
                      </div>
                    );
                  })}
              </ContainerAllWorkspacesApplications>
            </div>
          );
        })}
      <FindOldApps />
    </div>
  );
}
