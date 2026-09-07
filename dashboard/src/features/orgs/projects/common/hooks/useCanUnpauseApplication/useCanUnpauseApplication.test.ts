import { vi } from 'vitest';
import { renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import useCanUnpauseApplication from './useCanUnpauseApplication';

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

function renderCanUnpause(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
  currentProject: typeof project | null = project,
) {
  mocks.useAppState.mockReturnValue({
    state,
    desiredState,
    project: currentProject,
  });

  return renderHook(() => useCanUnpauseApplication()).result.current;
}

describe('useCanUnpauseApplication', () => {
  it.each([
    { label: 'Paused -> Paused', desiredState: ApplicationStatus.Paused },
    { label: 'Paused -> Migrating', desiredState: ApplicationStatus.Migrating },
  ])('allows unpausing for $label', ({ desiredState }) => {
    expect(renderCanUnpause(ApplicationStatus.Paused, desiredState)).toBe(true);
  });

  it.each([
    {
      label: 'Paused -> Live, a wake request is already submitted',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Live,
    },
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    },
    {
      label: 'Unpausing -> Live',
      state: ApplicationStatus.Unpausing,
      desiredState: ApplicationStatus.Live,
    },
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
  ])('blocks unpausing for $label', ({ state, desiredState }) => {
    expect(renderCanUnpause(state, desiredState)).toBe(false);
  });

  it('blocks unpausing when the project is missing', () => {
    expect(
      renderCanUnpause(
        ApplicationStatus.Paused,
        ApplicationStatus.Paused,
        null,
      ),
    ).toBe(false);
  });
});
