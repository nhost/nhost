import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import ProjectStateScreen from '@/features/orgs/layout/ProjectGuard/ProjectStateScreen';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectStateQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, TestUserEvent } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

const mocks = vi.hoisted(() => ({
  unpauseApplication: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    basePath: '',
    pathname: '/orgs/xyz/projects/test-project/database',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]/database',
    asPath: '/orgs/xyz/projects/test-project/database',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    isFallback: false,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  }),
}));

vi.mock('@/generated/graphql', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/generated/graphql')>();

  return {
    ...original,
    useUnpauseApplicationMutation: () => [
      mocks.unpauseApplication,
      { loading: false },
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

const server = setupServer(tokenQuery);

function usePausedProjectWithDesiredState(desiredState: ApplicationStatus) {
  server.use(
    getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
      desiredState,
    }),
  );
}

describe('ProjectStateScreen', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    server.listen();
  });

  beforeEach(() => {
    mocks.unpauseApplication.mockReset().mockResolvedValue({});
    queryClient.clear();
    server.resetHandlers(tokenQuery);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
  });

  it('wakes a paused project', async () => {
    usePausedProjectWithDesiredState(ApplicationStatus.Paused);
    render(<ProjectStateScreen />);
    const user = new TestUserEvent();

    await user.click(await screen.findByRole('button', { name: 'Wake up' }));

    expect(mocks.unpauseApplication).toHaveBeenCalledOnce();
  });

  it('shows the waking-up state while desiredState is Live', async () => {
    usePausedProjectWithDesiredState(ApplicationStatus.Live);
    render(<ProjectStateScreen />);

    expect(
      await screen.findByText('Project is waking up...'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Wake up' }),
    ).not.toBeInTheDocument();
  });
});
