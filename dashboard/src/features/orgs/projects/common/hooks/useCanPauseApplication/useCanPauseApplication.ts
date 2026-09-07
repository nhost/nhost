import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

export default function useCanPauseApplication(): boolean {
  const { state, desiredState, project } = useAppState();

  return (
    Boolean(project) &&
    !(
      desiredState === ApplicationStatus.Paused &&
      state === ApplicationStatus.Live
    ) &&
    state !== ApplicationStatus.Paused &&
    state !== ApplicationStatus.Pausing &&
    state !== ApplicationStatus.Unpausing
  );
}
