import { vi } from 'vitest';
import ProjectStateScreen from '@/features/orgs/layout/OrgLayout/ProjectStateScreen';
import { mockApplication, mockMatchMediaValue } from '@/tests/mocks';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({
  wakeLoading: false,
  wakeApplication: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    route: '/orgs/[orgSlug]/projects/[appSubdomain]/database',
    query: { appSubdomain: 'test-project' },
  }),
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...original,
    usePauseApplicationMutation: () => [vi.fn(), { loading: false }],
    useUnpauseApplicationMutation: () => [
      mocks.wakeApplication,
      { loading: mocks.wakeLoading },
    ],
  };
});

vi.mock('@/features/orgs/projects/common/hooks/useAppPausedReason', () => ({
  useAppPausedReason: () => ({
    freeAndLiveProjectsNumberExceeded: false,
  }),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({ currentOrg: { id: 'organization-id' } }),
}));

vi.mock('@/lib/segment', () => ({
  analytics: { track: vi.fn() },
}));

vi.mock('@/hooks/useUserData', () => ({
  useUserData: () => ({ id: 'user-id' }),
}));

interface DeferredPromise {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
}

function createDeferredPromise(): DeferredPromise {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

const pausedAppState = {
  state: ApplicationStatus.Paused,
  desiredState: ApplicationStatus.Paused,
  project: {
    ...mockApplication,
    id: 'project-id',
  },
};

describe('ProjectStateScreen', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  beforeEach(() => {
    mocks.wakeLoading = false;
    mocks.wakeApplication.mockReset().mockResolvedValue({});
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows mutation loading, then keeps wake disabled without a spinner after acceptance', async () => {
    const mutation = createDeferredPromise();
    mocks.wakeApplication.mockReturnValue(mutation.promise);
    const { container, rerender } = render(
      <ProjectStateScreen appState={pausedAppState} />,
    );
    const user = new TestUserEvent();

    await user.click(screen.getByRole('button', { name: 'Wake up' }));
    expect(mocks.wakeApplication).toHaveBeenCalledOnce();

    mocks.wakeLoading = true;
    rerender(<ProjectStateScreen appState={pausedAppState} />);
    const loadingButton = screen.getByRole('button', { name: 'Wake up' });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton.querySelector('svg')).toBeInTheDocument();

    mutation.resolve({});
    mocks.wakeLoading = false;
    await waitFor(() => {
      expect(mocks.wakeApplication).toHaveBeenCalledOnce();
    });
    rerender(<ProjectStateScreen appState={pausedAppState} />);

    const acceptedButton = screen.getByRole('button', { name: 'Wake up' });
    expect(acceptedButton).toBeDisabled();
    expect(acceptedButton.querySelector('svg')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('Project is waking up...');
  });

  it('disables wake from a persisted stable mismatch after mounting', () => {
    render(
      <ProjectStateScreen
        appState={{
          ...pausedAppState,
          desiredState: ApplicationStatus.Live,
        }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Wake up' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).not.toBeInTheDocument();
  });

  it('disables wake when the lifecycle snapshot belongs to another route', () => {
    render(
      <ProjectStateScreen
        appState={{
          ...pausedAppState,
          project: {
            ...pausedAppState.project,
            subdomain: 'previous-project',
          },
        }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wake up' })).toBeDisabled();
  });
});
