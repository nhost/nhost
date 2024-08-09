import { useAppState } from '@/features/projects/common/hooks/useAppState';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { usePreviousApplicationStates } from '@/features/projects/common/hooks/usePreviousApplicationStates';
import { ApplicationStatus } from '@/types/application';
import { useRouter } from 'next/router';

/**
 * This hook will check the route, the environment, and the history of the states of the app to correctly render the navigation header.
 */
export default function useNavigationVisible() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { state } = useAppState();
  const previousApplicationState = usePreviousApplicationStates();

  const router = useRouter();

  if (router.route === '/') {
    return false;
  }

  if (router.route === '/new' || router.route === '/404') {
    return false;
  }

  if (router.query.workspaceSlug && !router.query.appSlug) {
    return false;
  }

  if (!currentProject) {
    return false;
  }

  if (currentProject.appStates?.length === 0) {
    return false;
  }

  if (currentProject.desiredState === ApplicationStatus.Migrating) {
    return false;
  }

  if (
    state === ApplicationStatus.Migrating &&
    currentProject.desiredState === ApplicationStatus.Live
  ) {
    return true;
  }

  if (
    state === ApplicationStatus.Live ||
    state === ApplicationStatus.Updating
  ) {
    return true;
  }

  if (
    state === ApplicationStatus.Errored &&
    previousApplicationState === ApplicationStatus.Updating
  ) {
    return true;
  }

  return false;
}
