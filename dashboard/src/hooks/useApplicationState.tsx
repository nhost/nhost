import { ApplicationStatus } from '@/types/application';
import { useCurrentWorkspaceAndApplication } from './useCurrentWorkspaceAndApplication';

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useApplicationState(): ApplicationStatus {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const noApplication = !currentApplication;

  if (noApplication) {
    return ApplicationStatus.Empty;
  }

  const emptyApplicationStates = !currentApplication.appStates;

  if (noApplication || emptyApplicationStates) {
    return ApplicationStatus.Empty;
  }

  if (currentApplication.appStates?.length === 0) {
    return ApplicationStatus.Empty;
  }

  return currentApplication.appStates[0].stateId;
}
