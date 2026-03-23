import useAppState from '@/features/orgs/projects/common/hooks/useAppState/useAppState';
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
export default function useIsProjectReady(): boolean {
  const { state } = useAppState();
  return projectReadyStates.has(state);
}
