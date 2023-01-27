import { FindOldApps } from '@/components/home';
import type { UserData } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import type { Application, ApplicationState } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import { Avatar } from '@/ui/Avatar';
import StateBadge from '@/ui/StateBadge';
import type { DeploymentStatus } from '@/ui/StatusCircle';
import { StatusCircle } from '@/ui/StatusCircle';
import Divider from '@/ui/v2/Divider';
import Link from '@/ui/v2/Link';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { getApplicationStatusString } from '@/utils/helpers';
import { formatDistance } from 'date-fns';
import Image from 'next/image';
import NavLink from 'next/link';
import { Fragment } from 'react';

function ApplicationCreatedAt({ createdAt }: any) {
  return (
    <Text component="span" className="text-sm">
      created{' '}
      {formatDistance(new Date(createdAt), new Date(), {
        addSuffix: true,
      })}
    </Text>
  );
}

function LastSuccessfulDeployment({ deployment }: any) {
  return (
    <span className="flex flex-row">
      <Avatar
        component="span"
        name={deployment.commitUserName}
        avatarUrl={deployment.commitUserAvatarUrl}
        className="mr-1 h-4 w-4 self-center"
      />
      <Text component="span" className="self-center text-sm">
        {deployment.commitUserName} deployed{' '}
        {formatDistance(new Date(deployment.deploymentEndedAt), new Date(), {
          addSuffix: true,
        })}
      </Text>
    </span>
  );
}

function CurrentDeployment({ deployment }: any) {
  return (
    <span className="flex flex-row">
      <Avatar
        component="span"
        name={deployment.commitUserName}
        avatarUrl={deployment.commitUserAvatarUrl}
        className="mr-1 h-4 w-4 self-center"
      />
      <Text className="self-center text-sm">
        {deployment.commitUserName} updated just now
      </Text>
    </span>
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

          const workspaceProjects = workspace.applications
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
            });

          return (
            <div key={workspace.slug} className="my-8">
              <NavLink href={`/${workspace.slug}`} passHref>
                <Link
                  href={`${workspace.slug}`}
                  className="mb-1.5 block font-medium"
                  underline="none"
                  sx={{ color: 'text.primary' }}
                >
                  {workspace.name}
                </Link>
              </NavLink>
              <List className="grid grid-flow-row border-y">
                {workspaceProjects.map((app, index) => {
                  const isDeployingToProduction = app.deployments[0]
                    ? app.deployments[0].deploymentStatus === 'DEPLOYING'
                    : false;

                  return (
                    <Fragment key={app.slug}>
                      <ListItem.Root
                        secondaryAction={
                          <div className="grid grid-flow-col gap-px">
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
                                checkStatusOfTheApplication(app.appStates),
                              )}
                            />
                          </div>
                        }
                      >
                        <NavLink
                          href={`${workspace?.slug}/${app.slug}`}
                          passHref
                        >
                          <ListItem.Button className="rounded-none">
                            <ListItem.Avatar>
                              <div className="h-10 w-10 overflow-hidden rounded-lg">
                                <Image
                                  src="/logos/new.svg"
                                  alt="Nhost Logo"
                                  width={40}
                                  height={40}
                                />
                              </div>
                            </ListItem.Avatar>

                            <ListItem.Text
                              primary={app.name}
                              secondary={
                                <>
                                  {isDeployingToProduction && (
                                    <CurrentDeployment
                                      deployment={app.deployments[0]}
                                    />
                                  )}

                                  {!isDeployingToProduction &&
                                    app.deployments[0] && (
                                      <LastSuccessfulDeployment
                                        deployment={app.deployments[0]}
                                      />
                                    )}

                                  {!isDeployingToProduction &&
                                    !app.deployments[0] && (
                                      <ApplicationCreatedAt
                                        createdAt={app.createdAt}
                                      />
                                    )}
                                </>
                              }
                            />
                          </ListItem.Button>
                        </NavLink>
                      </ListItem.Root>

                      {index < workspaceProjects.length - 1 && (
                        <Divider component="li" />
                      )}
                    </Fragment>
                  );
                })}
              </List>
            </div>
          );
        })}
      <FindOldApps />
    </div>
  );
}
