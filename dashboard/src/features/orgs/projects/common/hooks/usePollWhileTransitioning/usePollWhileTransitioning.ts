import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { PROJECT_WITH_STATE_QUERY_KEY } from '@/features/orgs/projects/hooks/useProjectWithState';
import { useGetApplicationStateQuery } from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';

const TRANSITIONING_STATES = new Set<ApplicationStatus>([
  ApplicationStatus.Pausing,
  ApplicationStatus.Unpausing,
  ApplicationStatus.Restoring,
]);

const TERMINAL_STATES = new Set<ApplicationStatus>([
  ApplicationStatus.Live,
  ApplicationStatus.Paused,
  ApplicationStatus.Errored,
]);

/**
 * Polls the application state while the project is transitioning
 * (pausing/unpausing/restoring). Once polling observes a terminal state, it
 * invalidates the TanStack project state query that gates the project screen
 * and drives the status badge in the project switcher.
 */
export default function usePollWhileTransitioning() {
  const { state } = useAppState();
  const { project } = useProject();
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

    if (!lastState || !TERMINAL_STATES.has(lastState.stateId)) {
      return;
    }

    if (project?.subdomain) {
      queryClient.invalidateQueries({
        queryKey: [PROJECT_WITH_STATE_QUERY_KEY, project.subdomain],
      });
    }
  }, [data, project?.subdomain, queryClient]);
}
