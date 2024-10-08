import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';

/**
 * This hook returns the current application state. If the application state
 * has not been filled, it returns an Empty application status.
 */
export default function useAppState(): {
  state: ApplicationStatus;
  message?: string;
} {
  const { project } = useProject({ poll: true });
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
