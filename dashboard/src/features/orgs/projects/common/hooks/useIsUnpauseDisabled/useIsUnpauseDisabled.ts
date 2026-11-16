import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { ApplicationStatus } from '@/types/application';

export default function useIsUnpauseDisabled(): boolean {
  const isPlatform = useIsPlatform();
  const { state, desiredState, project } = useAppState();

  return (
    !isPlatform ||
    !project ||
    state !== ApplicationStatus.Paused ||
    desiredState === ApplicationStatus.Live
  );
}
