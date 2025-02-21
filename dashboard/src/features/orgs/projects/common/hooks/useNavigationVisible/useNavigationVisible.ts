import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { usePreviousApplicationStates } from '@/features/orgs/projects/common/hooks/usePreviousApplicationStates';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ApplicationStatus } from '@/types/application';
import { useRouter } from 'next/router';

/**
 * This hook will check the route, the environment, and the history of the states of the app to correctly render the navigation header.
 */
export default function useNavigationVisible() {
  const { project } = useProject();
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

  if (!project) {
    return false;
  }

  if (project.appStates?.length === 0) {
    return false;
  }

  if (project.desiredState === ApplicationStatus.Migrating) {
    return false;
  }

  if (
    state === ApplicationStatus.Migrating &&
    project.desiredState === ApplicationStatus.Live
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
