import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import useCanPauseApplication from './useCanPauseApplication';

const mocks = vi.hoisted(() => ({
  useAppState: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

const project = {
  id: 'project-id',
  name: 'Test Project',
  subdomain: 'test-project',
};

function renderCanPause(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
  currentProject: typeof project | null = project,
) {
  mocks.useAppState.mockReturnValue({
    state,
    desiredState,
    project: currentProject,
  });

  return renderHook(() => useCanPauseApplication()).result.current;
}

describe('useCanPauseApplication', () => {
  it.each([
    {
      label: 'Live -> Live',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Errored -> Live',
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Updating -> Live',
      state: ApplicationStatus.Updating,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Restoring -> Live',
      state: ApplicationStatus.Restoring,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Provisioning -> Live',
      state: ApplicationStatus.Provisioning,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Errored -> Paused, a pause request is already submitted',
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Restoring -> Paused, a pause request is already submitted',
      state: ApplicationStatus.Restoring,
      desiredState: ApplicationStatus.Paused,
    },
  ])('allows pausing for $label', ({ state, desiredState }) => {
    expect(renderCanPause(state, desiredState)).toBe(true);
  });

  it.each([
    {
      label: 'Live -> Paused, a pause request is already submitted',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Paused -> Paused',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Unpausing -> Live',
      state: ApplicationStatus.Unpausing,
      desiredState: ApplicationStatus.Live,
    },
  ])('blocks pausing for $label', ({ state, desiredState }) => {
    expect(renderCanPause(state, desiredState)).toBe(false);
  });

  it('blocks pausing when the project is missing', () => {
    expect(
      renderCanPause(ApplicationStatus.Live, ApplicationStatus.Live, null),
    ).toBe(false);
  });

  it('keeps allowing pause clicks on an errored project once a pause request has been submitted', () => {
    mocks.useAppState.mockReturnValue({
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Live,
      project,
    });

    const { result, rerender } = renderHook(() => useCanPauseApplication());

    expect(result.current).toBe(true);

    mocks.useAppState.mockReturnValue({
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Paused,
      project,
    });
    rerender();

    expect(result.current).toBe(true);
  });
});
