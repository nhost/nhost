import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetApplicationStateQuery,
  useGetOrganizationsLazyQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';

const TRANSITIONING_STATES = new Set([
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
]);

const PROJECT_WITH_STATE_QUERY_KEY = 'projectWithState';

/**
 * Polls the application state while the project is transitioning
 * (unpausing/restoring). Once polling observes a terminal state, it refreshes
 * Apollo organization data for org-level views and invalidates the TanStack
 * project state query that gates the project screen.
 */
export default function usePollWhileTransitioning() {
  const { state } = useAppState();
  const { project } = useProject();
  const userData = useUserData();
  const [getOrgs] = useGetOrganizationsLazyQuery();
  const queryClient = useQueryClient();

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

      if (project?.subdomain) {
        queryClient.invalidateQueries({
          queryKey: [PROJECT_WITH_STATE_QUERY_KEY, project.subdomain],
        });
      }
    }
  }, [data, getOrgs, project?.subdomain, queryClient, userData?.id]);
}
