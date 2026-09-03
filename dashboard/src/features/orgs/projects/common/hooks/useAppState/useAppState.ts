import { useEffect } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useProjectWithState } from '@/features/orgs/projects/hooks/useProjectWithState';
import { isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';

export interface AppState {
  state: ApplicationStatus;
  desiredState: ApplicationStatus;
  project: ReturnType<typeof useProjectWithState>['project'];
}

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useAppState(): AppState {
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
    desiredState: project?.desiredState ?? ApplicationStatus.Empty,
    project,
  };
}
