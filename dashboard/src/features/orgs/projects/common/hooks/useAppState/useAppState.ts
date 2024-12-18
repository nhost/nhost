import { useProjectWithState } from '@/features/orgs/projects/hooks/useProjectWithState';
import { ApplicationStatus } from '@/types/application';

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useAppState(): {
  state: ApplicationStatus;
  message?: string;
} {
  const { project } = useProjectWithState();
  const noApplication = !project;

  if (noApplication) {
    return { state: ApplicationStatus.Empty };
  }

  const emptyApplicationStates = !project.appStates;

  if (noApplication || emptyApplicationStates) {
    return { state: ApplicationStatus.Empty };
  }

  if (project.appStates?.length === 0) {
    return { state: ApplicationStatus.Empty };
  }

  return {
    state: project.appStates[0].stateId,
    message: project.appStates[0].message,
  };
}
