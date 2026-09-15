import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import useIsUnpausing from './useIsUnpausing';

const mocks = vi.hoisted(() => ({
  useAppState: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

function renderIsUnpausing(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
) {
  mocks.useAppState.mockReturnValue({ state, desiredState, project: null });

  return renderHook(() => useIsUnpausing()).result.current;
}

describe('useIsUnpausing', () => {
  it.each([
    {
      label: 'Unpausing -> Live',
      state: ApplicationStatus.Unpausing,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Paused -> Live, the wake request landed before the state moved',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Live,
    },
  ])('reports an in-flight wake-up for $label', ({ state, desiredState }) => {
    expect(renderIsUnpausing(state, desiredState)).toBe(true);
  });

  it.each([
    {
      label: 'Paused -> Paused',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Live -> Live',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Live -> Paused, a pause is in flight instead',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Errored -> Live',
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Live,
    },
  ])('reports no wake-up for $label', ({ state, desiredState }) => {
    expect(renderIsUnpausing(state, desiredState)).toBe(false);
  });
});
