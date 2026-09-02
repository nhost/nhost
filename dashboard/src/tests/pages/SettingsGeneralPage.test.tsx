import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import SettingsGeneralPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
} from '@/tests/mocks';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, TestUserEvent } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({
  snapshot: {
    state: 5,
    desiredState: 5,
    project: {
      id: '1',
      name: 'Test Project',
      subdomain: 'test-project',
    } as { id: string; name: string; subdomain: string } | null,
  },
  pauseApplication: vi.fn(),
  wakeApplication: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: () => mocks.snapshot,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsCurrentUserOwner', () => ({
  useIsCurrentUserOwner: () => true,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));

vi.mock('@/features/orgs/projects/common/hooks/useRunServices', () => ({
  useRunServices: () => ({ services: [] }),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('@/features/orgs/projects/hooks/useOrgs')
    >();

  return {
    ...original,
    useOrgs: () => ({ currentOrg: mockOrganization, loading: false }),
  };
});

vi.mock('@/features/orgs/projects/hooks/useProject', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('@/features/orgs/projects/hooks/useProject')
    >();

  return {
    ...original,
    useProject: () => ({ project: mockApplication, loading: false }),
  };
});

vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => vi.fn(),
}));

vi.mock('@/lib/segment', () => ({
  analytics: { track: vi.fn() },
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...original,
    useUpdateApplicationMutation: () => [vi.fn()],
    useBillingDeleteAppMutation: () => [vi.fn()],
    usePauseApplicationMutation: () => [
      mocks.pauseApplication,
      { loading: false },
    ],
    useUnpauseApplicationMutation: () => [
      mocks.wakeApplication,
      { loading: false },
    ],
  };
});

const stableLiveSnapshot = {
  state: ApplicationStatus.Live,
  desiredState: ApplicationStatus.Live,
  project: {
    id: '1',
    name: 'Test Project',
    subdomain: 'test-project',
  },
};

const stablePausedSnapshot = {
  ...stableLiveSnapshot,
  state: ApplicationStatus.Paused,
  desiredState: ApplicationStatus.Paused,
};

const server = setupServer(tokenQuery, prefetchNewAppQuery);

describe('SettingsGeneralPage lifecycle actions', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    server.listen();
  });

  beforeEach(() => {
    mocks.snapshot = { ...stableLiveSnapshot };
    mocks.pauseApplication.mockReset().mockResolvedValue({});
    mocks.wakeApplication.mockReset().mockResolvedValue({});
    queryClient.clear();
    server.resetHandlers(tokenQuery, prefetchNewAppQuery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('selects the lifecycle card from actual state', () => {
    const { rerender } = render(<SettingsGeneralPage />);

    expect(screen.getByText('Pause Project')).toBeInTheDocument();
    expect(screen.queryByText('Wake up Project')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();

    mocks.snapshot = { ...stablePausedSnapshot };
    rerender(<SettingsGeneralPage />);

    expect(screen.getByText('Wake up Project')).toBeInTheDocument();
    expect(screen.queryByText('Pause Project')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wake up' })).toBeEnabled();
  });

  it('wires pause through confirmation', async () => {
    const user = new TestUserEvent();
    render(<SettingsGeneralPage />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Pause Project?')).toBeInTheDocument();
    expect(mocks.pauseApplication).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mocks.pauseApplication).toHaveBeenCalledOnce();
  });

  it('blocks a stale pause confirmation after desired state changes', async () => {
    const user = new TestUserEvent();
    const { rerender } = render(<SettingsGeneralPage />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByText('Pause Project?')).toBeInTheDocument();

    mocks.snapshot = {
      ...stableLiveSnapshot,
      desiredState: ApplicationStatus.Paused,
    };
    rerender(<SettingsGeneralPage />);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mocks.pauseApplication).not.toHaveBeenCalled();
  });

  it('preserves actual pausing presentation', () => {
    mocks.snapshot = {
      ...stableLiveSnapshot,
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
    };
    render(<SettingsGeneralPage />);

    const button = screen.getByRole('button', { name: 'Pausing...' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('wakes a paused project', async () => {
    mocks.snapshot = { ...stablePausedSnapshot };
    const user = new TestUserEvent();
    render(<SettingsGeneralPage />);

    await user.click(screen.getByRole('button', { name: 'Wake up' }));

    expect(mocks.wakeApplication).toHaveBeenCalledOnce();
  });
});
