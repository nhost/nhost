import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

export default function useCanUnpauseApplication(): boolean {
  const { state, desiredState, project } = useAppState();

  return (
    Boolean(project) &&
    state === ApplicationStatus.Paused &&
    desiredState !== ApplicationStatus.Live
  );
}
