import { useEffect } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useProjectWithState } from '@/features/orgs/projects/hooks/useProjectWithState';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

const projectReadyStates = new Set([
  ApplicationStatus.Live,
  ApplicationStatus.Updating,
  ApplicationStatus.Migrating,
  ApplicationStatus.Errored,
]);

/**
 * Returns true when the project services are available for data queries.
 */
export function useIsProjectReady(): boolean {
  const { state } = useAppState();
  return projectReadyStates.has(state);
}

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useAppState(): {
  state: ApplicationStatus;
} {
  const { project, projectNotFound } = useProjectWithState();
  const { refetch } = useProject();

  useEffect(() => {
    if (projectNotFound) {
      refetch();
    }
  }, [projectNotFound, refetch]);

  return {
    state: isNotEmptyValue(project?.appStates?.[0])
      ? project.appStates[0].stateId
      : ApplicationStatus.Empty,
  };
}
