import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { ApplicationStatus } from '@/types/application';

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useAppState(): {
  state: ApplicationStatus;
  message?: string;
} {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const noApplication = !currentProject;

  if (noApplication) {
    return { state: ApplicationStatus.Empty };
  }

  const emptyApplicationStates = !currentProject.appStates;

  if (noApplication || emptyApplicationStates) {
    return { state: ApplicationStatus.Empty };
  }

  if (currentProject.appStates?.length === 0) {
    return { state: ApplicationStatus.Empty };
  }

  return {
    state: currentProject.appStates[0].stateId,
    message: currentProject.appStates[0].message,
  };
}
