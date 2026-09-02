import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import type { AppState } from '@/features/orgs/projects/common/hooks/useAppState/useAppState';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getLockedProjectErrorMessage } from '@/features/orgs/utils/getLockedProjectErrorMessage';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  usePauseApplicationMutation,
  useUnpauseApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';
import { ApplicationStatus } from '@/types/application';

interface UseProjectLifecycleActionsReturn {
  pauseProject: () => Promise<void>;
  wakeUpProject: () => Promise<void>;
  pauseLoading: boolean;
  wakeLoading: boolean;
  pauseDisabled: boolean;
  wakeUpDisabled: boolean;
}

type LifecycleAction = 'pause' | 'wakeUp';

export default function useProjectLifecycleActions({
  state,
  desiredState,
  project,
}: AppState): UseProjectLifecycleActionsReturn {
  const {
    query: { appSubdomain },
  } = useRouter();
  const routeSubdomain = appSubdomain as string;
  const queryClient = useQueryClient();
  const userData = useUserData();
  const { currentOrg } = useOrgs();

  const hasCurrentProject = Boolean(
    routeSubdomain && project?.id && project.subdomain === routeSubdomain,
  );
  const canPause =
    hasCurrentProject &&
    desiredState !== ApplicationStatus.Paused &&
    state !== ApplicationStatus.Paused &&
    state !== ApplicationStatus.Pausing;
  const canWakeUp =
    hasCurrentProject &&
    state === ApplicationStatus.Paused &&
    desiredState === ApplicationStatus.Paused;

  const requestRef = useRef<LifecycleAction | null>(null);
  const latestActionState = {
    canPause,
    canWakeUp,
    organizationId: currentOrg?.id ?? null,
    project,
    routeSubdomain,
  };
  const latestActionStateRef = useRef(latestActionState);

  useEffect(() => {
    latestActionStateRef.current = latestActionState;
  });

  useEffect(() => {
    if (
      (requestRef.current === 'pause' && !canPause) ||
      (requestRef.current === 'wakeUp' && !canWakeUp)
    ) {
      requestRef.current = null;
    }
  }, [canPause, canWakeUp]);

  const invalidateProjectQueries = useCallback(
    async (requestRouteSubdomain: string) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['projectWithState', requestRouteSubdomain],
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ['project', requestRouteSubdomain],
          exact: true,
        }),
      ]);
    },
    [queryClient],
  );

  const [pauseApplication, { loading: pauseLoading }] =
    usePauseApplicationMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });
  const [unpauseApplication, { loading: wakeLoading }] =
    useUnpauseApplicationMutation({
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  const pauseProject = useCallback(async () => {
    const {
      canPause: isPauseAllowed,
      organizationId,
      project: currentProject,
      routeSubdomain: currentRouteSubdomain,
    } = latestActionStateRef.current;
    if (!isPauseAllowed || !currentProject || requestRef.current === 'pause') {
      return;
    }

    requestRef.current = 'pause';

    await execPromiseWithErrorToast(
      async () => {
        try {
          await pauseApplication({
            variables: { appId: currentProject.id },
          });
        } catch (error) {
          if (requestRef.current === 'pause') {
            requestRef.current = null;
          }
          throw error;
        }

        analytics.track('Project Paused', {
          reason: 'manual',
          org_id: organizationId,
          project_id: currentProject.id,
        });
        await invalidateProjectQueries(currentRouteSubdomain);
      },
      {
        loadingMessage: `Pausing ${currentProject.name}...`,
        successMessage: `${currentProject.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: getLockedProjectErrorMessage(
          `An error occurred while trying to pause the project "${currentProject.name}". Please try again.`,
        ),
      },
    );
  }, [invalidateProjectQueries, pauseApplication]);

  const wakeUpProject = useCallback(async () => {
    const {
      canWakeUp: isWakeUpAllowed,
      organizationId,
      project: currentProject,
      routeSubdomain: currentRouteSubdomain,
    } = latestActionStateRef.current;
    if (
      !isWakeUpAllowed ||
      !currentProject ||
      requestRef.current === 'wakeUp'
    ) {
      return;
    }

    requestRef.current = 'wakeUp';

    await execPromiseWithErrorToast(
      async () => {
        try {
          await unpauseApplication({
            variables: { appId: currentProject.id },
          });
        } catch (error) {
          if (requestRef.current === 'wakeUp') {
            requestRef.current = null;
          }
          throw error;
        }

        analytics.track('Project Resumed', {
          org_id: organizationId,
          project_id: currentProject.id,
        });
        await invalidateProjectQueries(currentRouteSubdomain);
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
      },
    );
  }, [invalidateProjectQueries, unpauseApplication]);

  return {
    pauseProject,
    wakeUpProject,
    pauseLoading,
    wakeLoading,
    pauseDisabled: !canPause || requestRef.current === 'pause',
    wakeUpDisabled: !canWakeUp || requestRef.current === 'wakeUp',
  };
}
