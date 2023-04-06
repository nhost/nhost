import { ApplicationStatus } from '@/types/application';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useApplicationState(): {
  state: ApplicationStatus;
  message?: string;
} {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const noApplication = !currentApplication;

  if (noApplication) {
    return { state: ApplicationStatus.Empty };
  }

  const emptyApplicationStates = !currentApplication.appStates;

  if (noApplication || emptyApplicationStates) {
    return { state: ApplicationStatus.Empty };
  }

  if (currentApplication.appStates?.length === 0) {
    return { state: ApplicationStatus.Empty };
  }

  return {
    state: currentApplication.appStates[0].stateId,
    message: currentApplication.appStates[0].message,
  };
}
