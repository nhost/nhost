import { vi } from 'vitest';
import { useIsUnpauseDisabled } from '@/features/orgs/projects/common/hooks/useIsUnpauseDisabled';
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

function renderIsUnpauseDisabled(
  state: ApplicationStatus,
  desiredState: ApplicationStatus,
  currentProject: typeof project | null = project,
) {
  mocks.useAppState.mockReturnValue({
    state,
    desiredState,
    project: currentProject,
  });

  return renderHook(() => useIsUnpauseDisabled()).result.current;
}

describe('useIsUnpauseDisabled', () => {
  beforeEach(() => {
    mocks.isPlatform.mockReturnValue(true);
  });

  it.each([
    { label: 'Paused -> Paused', desiredState: ApplicationStatus.Paused },
    { label: 'Paused -> Migrating', desiredState: ApplicationStatus.Migrating },
  ])('keeps the unpause action enabled for $label', ({ desiredState }) => {
    expect(
      renderIsUnpauseDisabled(ApplicationStatus.Paused, desiredState),
    ).toBe(false);
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
  ])('disables the unpause action for $label', ({ state, desiredState }) => {
    expect(renderIsUnpauseDisabled(state, desiredState)).toBe(true);
  });

  it('disables the unpause action when the project is missing', () => {
    expect(
      renderIsUnpauseDisabled(
        ApplicationStatus.Paused,
        ApplicationStatus.Paused,
        null,
      ),
    ).toBe(true);
  });

  it('disables the unpause action outside the platform', () => {
    mocks.isPlatform.mockReturnValue(false);

    expect(
      renderIsUnpauseDisabled(
        ApplicationStatus.Paused,
        ApplicationStatus.Paused,
      ),
    ).toBe(true);
  });
});
