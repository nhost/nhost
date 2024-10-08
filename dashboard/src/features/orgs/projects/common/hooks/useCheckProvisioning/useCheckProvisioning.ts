import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  GetAllWorkspacesAndProjectsDocument,
  useGetApplicationStateQuery,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { useCallback, useEffect, useState } from 'react';

type ApplicationStateMetadata = {
  state: ApplicationStatus;
  createdAt?: string;
};

/**
 * This hook will poll for a new application state
 * when the component falls into the provisioning state.
 * When receiving at least one application state from the history
 * it will update the entire cache with the application state.
 */
export default function useCheckProvisioning() {
  const { project } = useProject();
  const [currentApplicationState, setCurrentApplicationState] =
    useState<ApplicationStateMetadata>({ state: ApplicationStatus.Empty });
  const isPlatform = useIsPlatform();

  const { data, startPolling, stopPolling, client } =
    useGetApplicationStateQuery({
      variables: { appId: project?.id },
      skip: !isPlatform || !project?.id,
    });

  async function updateOwnCache() {
    await client.refetchQueries({
      include: [GetAllWorkspacesAndProjectsDocument],
    });
  }

  const memoizedUpdateCache = useCallback(updateOwnCache, [client]);

  const currentApplicationId = project?.id;

  useEffect(() => {
    startPolling(2000);
  }, [startPolling]);

  useEffect(() => {
    if (!data?.app) {
      return;
    }

    if (data.app.appStates.length === 0) {
      return;
    }

    if (
      data.app.appStates[0].stateId === ApplicationStatus.Provisioning &&
      currentApplicationState.state === ApplicationStatus.Empty
    ) {
      setCurrentApplicationState({
        state: ApplicationStatus.Provisioning,
        createdAt: data.app.appStates[0].createdAt,
      });
    }

    if (data.app.appStates[0].stateId === ApplicationStatus.Live) {
      setCurrentApplicationState({
        state: ApplicationStatus.Live,
        createdAt: data.app.appStates[0].createdAt,
      });
      stopPolling();
      // Will update the cache and update with the new application state
      // which will trigger the correct application component
      // under `src\components\applications\App.tsx`
      memoizedUpdateCache();
      return;
    }
    if (data.app.appStates[0].stateId === ApplicationStatus.Errored) {
      if (currentApplicationState.state === ApplicationStatus.Errored) {
        return;
      }

      setCurrentApplicationState({
        state: ApplicationStatus.Errored,
        createdAt: data.app.appStates[0].createdAt,
      });
      discordAnnounce(
        `Application ${currentApplicationId} errored after provisioning: ${data.app.appStates[0].message}`,
      );
      stopPolling();
      memoizedUpdateCache();
    }
  }, [
    data,
    stopPolling,
    memoizedUpdateCache,
    currentApplicationId,
    currentApplicationState.state,
  ]);

  return currentApplicationState;
}
