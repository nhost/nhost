import { useEffect } from 'react';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';
import {
  useGetApplicationStateQuery,
  useGetOrganizationsLazyQuery,
} from '@/utils/__generated__/graphql';

const TRANSITIONING_STATES = new Set([
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
]);

/**
 * Polls the application state while the project is transitioning
 * (unpausing/restoring) and refreshes the organizations cache once it reaches a
 * terminal state, so `useAppState` observes the project becoming live again.
 */
export default function usePollWhileTransitioning() {
  const { state } = useAppState();
  const { project } = useProject();
  const userData = useUserData();
  const [getOrgs] = useGetOrganizationsLazyQuery();

  const isTransitioning = TRANSITIONING_STATES.has(state);

  const { data, startPolling, stopPolling } = useGetApplicationStateQuery({
    variables: { appId: project?.id },
    skip: !project?.id || !isTransitioning,
  });

  useEffect(() => {
    if (!isTransitioning) {
      stopPolling();
      return undefined;
    }

    startPolling(2000);

    return () => stopPolling();
  }, [isTransitioning, startPolling, stopPolling]);

  useEffect(() => {
    const [lastState] = data?.app?.appStates ?? [];

    if (!lastState) {
      return;
    }

    if (
      lastState.stateId === ApplicationStatus.Live ||
      lastState.stateId === ApplicationStatus.Errored
    ) {
      getOrgs({ variables: { userId: userData?.id } });
    }
  }, [data, getOrgs, userData?.id]);
}
