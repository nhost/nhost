import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';

export default function useIsPauseDisabled(): boolean {
  const isPlatform = useIsPlatform();
  const { state, desiredState, project } = useAppState();

  return (
    !isPlatform ||
    !project ||
    (desiredState === ApplicationStatus.Paused &&
      state === ApplicationStatus.Live) ||
    state === ApplicationStatus.Paused ||
    state === ApplicationStatus.Pausing ||
    state === ApplicationStatus.Unpausing
  );
}
