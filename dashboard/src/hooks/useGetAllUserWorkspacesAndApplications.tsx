import { useUserDataContext } from '@/context/workspace1-context';
import { useGetOneUserLazyQuery } from '@/generated/graphql';
import type { Workspace } from '@/types/workspace';
import { nhost } from '@/utils/nhost';
import { useEffect, useState } from 'react';
import useIsPlatform from './common/useIsPlatform';
import { useWithin } from './useWithin';

export type UserData = {
  workspaces: Workspace[] | [];
};

export function useGetAllUserWorkspacesAndApplications(
  fromState: boolean = false,
) {
  const { userContext, setUserContext } = useUserDataContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const isPlatform = useIsPlatform();
  const { within } = useWithin();

  const user = nhost.auth.getUser();

  const [getAllUserData, { loading, data, called }] = useGetOneUserLazyQuery({
    variables: {
      userId: user?.id,
    },
  });

  useEffect(() => {
    if (data || !isPlatform) {
      return;
    }

    getAllUserData();
  }, [data, isPlatform, getAllUserData]);

  // TODO: This useEffect should be broken down into multiple smaller parts
  // because dependency array is not expandable with the necessary dependencies
  // in its current form.
  useEffect(() => {
    if (data && userData && userData.workspaces.length !== 0) {
      return;
    }

    if (within && !data) {
      return;
    }

    if (
      within &&
      data &&
      data.user?.workspaceMembers &&
      data.user?.workspaceMembers.length === 0
    ) {
      return;
    }

    if (
      data?.user?.workspaceMembers &&
      data?.user?.workspaceMembers.length !== 0
    ) {
      const workspaces = data.user.workspaceMembers.map(({ workspace }) => {
        // note: this could be rather defined by the infrastructure when
        // creating the initial workspace
        const isDefaultWorkspace =
          workspace.name.toLowerCase() === 'default workspace' &&
          workspace.creatorUserId === user?.id &&
          /default-workspace-[a-z]+/i.test(workspace.slug);

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          creatorUserId: workspace.creatorUserId,
          default: isDefaultWorkspace,
          members: data.user.workspaceMembers.filter(
            ({ workspaceId }) => workspaceId === workspace.id,
          ),
          applications: workspace.apps.map((app) => {
            const userContextAppProps: any = {
              users: 0,
              userMetrics: {
                growth: 0,
                difference: 0,
                growthPercentage: 0,
                totalUsers: 0,
              },
              dbSize: 0,
            };

            if (userContext.workspaces?.length > 0) {
              const currentWorkspace = userContext.workspaces.find(
                (x) => x.id === workspace.id,
              );

              const currentApp = currentWorkspace?.applications.find(
                (x) => x.id === app.id,
              );

              if (currentWorkspace && currentApp) {
                return {
                  ...app,
                };
              }
            }

            return {
              ...app,
              ...userContextAppProps,
            };
          }),
        } as Workspace;
      });

      if (fromState) {
        setUserData({ workspaces });
      } else {
        setUserContext({ workspaces, metadata: userContext.metadata });
      }
    }
  }, [data, setUserData, called]);

  return { userData, setUserData, getAllUserData, loading, data, called };
}
