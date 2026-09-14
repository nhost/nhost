import { vi } from 'vitest';
import { useIsPauseDisabled } from '@/features/orgs/projects/common/hooks/useIsPauseDisabled';
import { renderHook } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({
  useAppState: vi.fn(),
  isPlatform: vi.fn(() => true),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: mocks.useAppState,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.isPlatform,
}));

const project = {
  id: 'project-id',
  name: 'Test Project',
  subdomain: 'test-project',
};

function renderIsPauseDisabled(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
  currentProject: typeof project | null = project,
) {
  mocks.useAppState.mockReturnValue({
    state,
    desiredState,
    project: currentProject,
  });

  return renderHook(() => useIsPauseDisabled()).result.current;
}

describe('useIsPauseDisabled', () => {
  beforeEach(() => {
    mocks.isPlatform.mockReturnValue(true);
  });

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
  ])('keeps the pause action enabled for $label', ({ state, desiredState }) => {
    expect(renderIsPauseDisabled(state, desiredState)).toBe(false);
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
  ])('disables the pause action for $label', ({ state, desiredState }) => {
    expect(renderIsPauseDisabled(state, desiredState)).toBe(true);
  });

  it('disables the pause action when the project is missing', () => {
    expect(
      renderIsPauseDisabled(
        ApplicationStatus.Live,
        ApplicationStatus.Live,
        null,
      ),
    ).toBe(true);
  });

  it('disables the pause action outside the platform', () => {
    mocks.isPlatform.mockReturnValue(false);

    expect(
      renderIsPauseDisabled(ApplicationStatus.Live, ApplicationStatus.Live),
    ).toBe(true);
  });

  it('keeps the pause action enabled on an errored project once a pause request has been submitted', () => {
    mocks.useAppState.mockReturnValue({
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Live,
      project,
    });

    const { result, rerender } = renderHook(() => useIsPauseDisabled());

    expect(result.current).toBe(false);

    mocks.useAppState.mockReturnValue({
      state: ApplicationStatus.Errored,
      desiredState: ApplicationStatus.Paused,
      project,
    });
    rerender();

    expect(result.current).toBe(false);
  });
});
