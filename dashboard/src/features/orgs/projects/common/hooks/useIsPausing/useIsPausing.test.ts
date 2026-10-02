import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import useIsPausing from './useIsPausing';

const mocks = vi.hoisted(() => ({
  useAppState: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

function renderIsPausing(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
) {
  mocks.useAppState.mockReturnValue({ state, desiredState, project: null });

  return renderHook(() => useIsPausing()).result.current;
}

describe('useIsPausing', () => {
  it.each([
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Live -> Paused, the pause request landed before the state moved',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Paused,
    },
  ])('reports an in-flight pause for $label', ({ state, desiredState }) => {
    expect(renderIsPausing(state, desiredState)).toBe(true);
  });

  it.each([
    {
      label: 'Live -> Live',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Paused -> Paused',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Paused -> Live, a wake-up is in flight instead',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Unpausing -> Live',
      state: ApplicationStatus.Unpausing,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Errored -> Paused',
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Paused,
    },
  ])('reports no pause for $label', ({ state, desiredState }) => {
    expect(renderIsPausing(state, desiredState)).toBe(false);
  });
});
