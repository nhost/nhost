import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import SettingsGeneralPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { getProPlanOnlyQuery } from '@/tests/msw/mocks/graphql/plansQuery';
import { prefetchNewAppQuery } from '@/tests/msw/mocks/graphql/prefetchNewAppQuery';
import { resourcesUnavailableQuery } from '@/tests/msw/mocks/graphql/resourceSettingsQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  within,
} from '@/tests/testUtils';
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
  isPlatform: vi.fn(() => true),
}));

vi.mock('next/router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/router')>()),
  useRouter: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: () => mocks.snapshot,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsCurrentUserOwner', () => ({
  useIsCurrentUserOwner: () => true,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.isPlatform,
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
    useOrgs: () => ({
      orgs: [mockOrganization],
      currentOrg: mockOrganization,
      loading: false,
    }),
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
  analytics: {
    track: vi.fn(),
    identify: vi.fn(),
    group: vi.fn(),
  },
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

const SETTINGS_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/settings';
const SETTINGS_PATH = '/orgs/xyz/projects/test-project/settings';

function setTab(tab: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: SETTINGS_ROUTE,
    route: SETTINGS_ROUTE,
    asPath: `${SETTINGS_PATH}?tab=${tab}`,
    query: { ...mockRouter.query, tab },
  });
}

const server = setupServer(
  tokenQuery,
  prefetchNewAppQuery,
  getOrganization,
  getProPlanOnlyQuery,
  resourcesUnavailableQuery,
  nhostGraphQLLink.query('GetEnvironmentVariables', () =>
    HttpResponse.json({
      data: {
        config: {
          id: 'ConfigConfig',
          __typename: 'ConfigConfig',
          global: { environment: [] },
          hasura: {
            adminSecret: 'test-admin-secret',
            webhookSecret: null,
            jwtSecrets: [],
          },
        },
      },
    }),
  ),
  nhostGraphQLLink.query('GetSecrets', () =>
    HttpResponse.json({ data: { appSecrets: [] } }),
  ),
  nhostGraphQLLink.query('getConfigRawJSON', () =>
    HttpResponse.json({ data: { configRawJSON: '{}' } }),
  ),
  nhostGraphQLLink.query('getAnnouncements', () =>
    HttpResponse.json({ data: { announcements: [] } }),
  ),
  nhostGraphQLLink.query('organizationMemberInvites', () =>
    HttpResponse.json({ data: { organizationMemberInvites: [] } }),
  ),
  nhostGraphQLLink.query('organizationNewRequests', () =>
    HttpResponse.json({ data: { organizationNewRequests: [] } }),
  ),
);

describe('SettingsGeneralPage', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    mocks.snapshot = { ...stableLiveSnapshot };
    mocks.pauseApplication.mockReset().mockResolvedValue({});
    mocks.wakeApplication.mockReset().mockResolvedValue({});
    mocks.isPlatform.mockReturnValue(true);
    vi.mocked(mockRouter.replace).mockClear();
    vi.mocked(mockRouter.push).mockClear();
    vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
    setTab('general');
    queryClient.clear();
    server.resetHandlers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    expect(mocks.pauseApplication).toHaveBeenCalledWith({
      variables: { appId: stableLiveSnapshot.project.id },
    });
  });

  it.each([
    {
      label: 'Live -> Paused, a pause request is already submitted',
      state: ApplicationStatus.Live,
      desiredState: ApplicationStatus.Paused,
      title: 'Pause Project',
      name: 'Pausing...',
    },
    {
      label: 'Pausing -> Paused',
      state: ApplicationStatus.Pausing,
      desiredState: ApplicationStatus.Paused,
      title: 'Pause Project',
      name: 'Pausing...',
    },
    {
      label: 'Paused -> Live, a wake request is already submitted',
      state: ApplicationStatus.Paused,
      desiredState: ApplicationStatus.Live,
      title: 'Wake up Project',
      name: 'Waking up...',
    },
    {
      label: 'Unpausing -> Live',
      state: ApplicationStatus.Unpausing,
      desiredState: ApplicationStatus.Live,
      title: 'Wake up Project',
      name: 'Waking up...',
    },
  ])(
    'reports "$name" under "$title" for $label',
    ({ state, desiredState, title, name }) => {
      mocks.snapshot = { ...stableLiveSnapshot, state, desiredState };
      render(<SettingsGeneralPage />);

      expect(screen.getByText(title)).toBeInTheDocument();

      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
    },
  );

  it.each([
    {
      label: 'Pause',
      snapshot: stableLiveSnapshot,
    },
    {
      label: 'Wake up',
      snapshot: stablePausedSnapshot,
    },
  ])('disables $label off-platform while idle', ({ label, snapshot }) => {
    mocks.isPlatform.mockReturnValue(false);
    mocks.snapshot = { ...snapshot };

    render(<SettingsGeneralPage />);

    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('replaces a missing tab with the general tab', () => {
    vi.mocked(useRouter).mockReturnValue(mockRouter);

    render(<SettingsGeneralPage />);

    expect(screen.queryByText('Project Name')).not.toBeInTheDocument();
    expect(mockRouter.replace).toHaveBeenCalledWith(
      {
        pathname: mockRouter.pathname,
        query: { ...mockRouter.query, tab: 'general' },
      },
      undefined,
      { shallow: true },
    );
  });

  it.each([
    { tab: 'compute-resources', heading: 'Compute Resources' },
    { tab: 'environment-variables', heading: 'Project Environment Variables' },
    { tab: 'secrets', heading: 'Secrets' },
    { tab: 'editor', heading: 'Configuration Editor' },
  ])('renders the $tab tab without redirecting', async ({ tab, heading }) => {
    setTab(tab);

    render(<SettingsGeneralPage />);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('links to each settings tab from the desktop sidebar', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...mockMatchMediaValue(query),
      matches: true,
    }));

    render(SettingsGeneralPage.getLayout(<SettingsGeneralPage />));

    const navigation = await within(screen.getByRole('main')).findByRole(
      'navigation',
      { name: 'Project settings navigation' },
    );
    const links = within(navigation).getAllByRole('link');

    expect(
      links.map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['General', `${SETTINGS_PATH}?tab=general`],
      ['Compute Resources', `${SETTINGS_PATH}?tab=compute-resources`],
      ['Environment Variables', `${SETTINGS_PATH}?tab=environment-variables`],
      ['Secrets', `${SETTINGS_PATH}?tab=secrets`],
      ['Configuration Editor', `${SETTINGS_PATH}?tab=editor`],
    ]);
    expect(
      within(navigation).getByRole('link', { name: 'General' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('GitHub repository connected')).toBeVisible();
  });

  it('renders the editor without the settings area notice', async () => {
    setTab('editor');

    render(SettingsGeneralPage.getLayout(<SettingsGeneralPage />));

    expect(
      await screen.findByRole('heading', { name: 'Configuration Editor' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('GitHub repository connected'),
    ).not.toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('wakes a paused project', async () => {
    mocks.snapshot = { ...stablePausedSnapshot };
    const user = new TestUserEvent();
    render(<SettingsGeneralPage />);

    await user.click(screen.getByRole('button', { name: 'Wake up' }));

    expect(mocks.wakeApplication).toHaveBeenCalledOnce();
    expect(mocks.wakeApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { appId: stablePausedSnapshot.project.id },
      }),
    );
  });
});
