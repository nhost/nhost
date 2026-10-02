import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

/**
 * Whether a wake-up is in flight. `desiredState` is set synchronously by the
 * mutation, so it flips before `state` catches up.
 */
export default function useIsUnpausing(): boolean {
  const { state, desiredState } = useAppState();

  return (
    state === ApplicationStatus.Unpausing ||
    (state === ApplicationStatus.Paused &&
      desiredState === ApplicationStatus.Live)
  );
}
