import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

/**
 * Whether a pause is in flight. `desiredState` is set synchronously by the
 * mutation, so it flips before `state` catches up.
 */
export default function useIsPausing(): boolean {
  const { state, desiredState } = useAppState();

  return (
    state === ApplicationStatus.Pausing ||
    (state === ApplicationStatus.Live &&
      desiredState === ApplicationStatus.Paused)
  );
}
