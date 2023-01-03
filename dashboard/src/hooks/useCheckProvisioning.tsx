import { useGetApplicationStateQuery } from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { useCallback, useEffect, useState } from 'react';
import useIsPlatform from './common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

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
export function useCheckProvisioning() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [currentApplicationState, setCurrentApplicationState] =
    useState<ApplicationStateMetadata>({ state: ApplicationStatus.Empty });
  const isPlatform = useIsPlatform();

  const { data, startPolling, stopPolling, client } =
    useGetApplicationStateQuery({
      variables: { appId: currentApplication?.id },
      skip: !isPlatform || !currentApplication?.id,
    });

  async function updateOwnCache() {
    await client.refetchQueries({
      include: ['getOneUser'],
    });
  }

  const memoizedUpdateCache = useCallback(updateOwnCache, [client]);

  useEffect(() => {
    startPolling(2000);
  }, [startPolling]);

  useEffect(() => {
    if (!data) {
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
        `Application ${currentApplication.id} errored after provisioning: ${data.app.appStates[0].message}`,
      );
      stopPolling();
      memoizedUpdateCache();
    }
  }, [
    data,
    stopPolling,
    memoizedUpdateCache,
    currentApplication.id,
    currentApplicationState.state,
  ]);

  return currentApplicationState;
}

export default useCheckProvisioning;
