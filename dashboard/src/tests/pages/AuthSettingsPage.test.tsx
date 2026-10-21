import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { vi } from 'vitest';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import * as graphql from '@/generated/graphql';
import AuthSettingsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/auth/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import { getOrganization } from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import { getProjectStateQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => ({
    orgs: [mockOrganization],
    currentOrg: mockOrganization,
    loading: false,
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useRunServices', () => ({
  useRunServices: () => ({ services: [] }),
}));
vi.mock('@/hooks/useTrackEvent', () => ({ useTrackEvent: () => vi.fn() }));

const server = setupServer(
  tokenQuery,
  getOrganization,
  http.get('*/v1/version', () => HttpResponse.json({ version: 'v2.0.0' })),
  getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
    desiredState: ApplicationStatus.Paused,
  }),
  nhostGraphQLLink.query('GetSignInMethods', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetAuthenticationSettings', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetRolesPermissions', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetSmtpSettings', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetOAuth2ProviderSettings', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetJWTSecrets', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetHasuraSettings', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('GetServerlessFunctionsSettings', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('getRateLimitConfig', () =>
    HttpResponse.json({ data: { config: null } }),
  ),
  nhostGraphQLLink.query('getConfiguredVersions', () =>
    HttpResponse.json({
      data: {
        config: {
          __typename: 'ConfigConfig',
          auth: { __typename: 'ConfigAuth', version: '0.46.0' },
          postgres: null,
          hasura: null,
          ai: null,
          storage: null,
        },
      },
    }),
  ),
  nhostGraphQLLink.query('getRecommendedSoftwareVersions', () =>
    HttpResponse.json({ data: { softwareVersions: [] } }),
  ),
  nhostGraphQLLink.query('getSoftwareVersions', () =>
    HttpResponse.json({ data: { softwareVersions: [] } }),
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

const SETTINGS_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/auth/settings';

const SETTINGS_PATH = '/orgs/xyz/projects/test-project/auth/settings';

const LOCAL_SETTINGS_PATH = '/orgs/local/projects/local/auth/settings';

interface SetTabOptions {
  isReady?: boolean;
  local?: boolean;
}

function setTab(
  tab?: string | string[],
  { isReady = true, local = false }: SetTabOptions = {},
) {
  const query = new URLSearchParams();
  for (const value of typeof tab === 'string' ? [tab] : (tab ?? [])) {
    query.append('tab', value);
  }
  const settingsPath = local ? LOCAL_SETTINGS_PATH : SETTINGS_PATH;
  const routeQuery = local
    ? { orgSlug: 'local', appSubdomain: 'local' }
    : mockRouter.query;
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: SETTINGS_ROUTE,
    route: SETTINGS_ROUTE,
    asPath: `${settingsPath}?${query}`,
    isReady,
    query: { ...routeQuery, tab },
  });
}

function renderTab(tab?: string | string[]) {
  setTab(tab);
  return render(<AuthSettingsPage />);
}

function loadProject() {
  vi.mocked(useProject).mockReturnValue({
    project: mockApplication,
    loading: false,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  mockScrollIntoViewAndPointerCapture();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.mocked(useProject).mockReturnValue({
    project: null,
    loading: true,
    projectNotFound: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(mockRouter.replace).mockResolvedValue(true);
  vi.mocked(mockRouter.push).mockResolvedValue(true);
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('AuthSettingsPage', () => {
  it('redirects before querying Auth settings when settings are disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    loadProject();
    setTab('custom-domain', { local: true });
    const settingsQuery = vi.spyOn(
      graphql,
      'useGetAuthenticationSettingsQuery',
    );

    render(AuthSettingsPage.getLayout(<AuthSettingsPage />));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/404');
    });
    expect(settingsQuery).not.toHaveBeenCalled();
  });

  it.each([undefined, 'unknown', ['smtp', 'jwt']])(
    'redirects the %s tab to the default tab',
    (tab) => {
      loadProject();
      renderTab(tab);

      expect(mockRouter.replace).toHaveBeenCalledWith(
        {
          pathname: SETTINGS_ROUTE,
          query: { ...mockRouter.query, tab: 'sign-in-methods' },
        },
        undefined,
        { shallow: true },
      );
    },
  );

  it('waits for router readiness before normalizing a missing tab', () => {
    loadProject();
    setTab(undefined, { isReady: false });
    render(<AuthSettingsPage />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['sign-in-methods', 'Email and Password'],
    ['oauth2-provider', 'OAuth2 Provider'],
    ['smtp', 'SMTP Settings'],
    ['authentication', 'Client URL'],
    ['roles-and-permissions', 'Default Allowed Roles'],
    ['jwt', 'JSON Web Token Settings'],
    ['custom-domain', 'Auth Custom Domain'],
    ['rate-limiting', 'Auth'],
  ])('renders the selected %s settings content', async (tab, heading) => {
    loadProject();
    renderTab(tab);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', {
        name:
          tab === 'sign-in-methods'
            ? 'Auth Custom Domain'
            : 'Email and Password',
      }),
    ).not.toBeInTheDocument();
  });

  it('selects the desktop link and keeps settings reachable while paused', async () => {
    loadProject();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...mockMatchMediaValue(query),
      matches: true,
    }));
    setTab('jwt');
    render(AuthSettingsPage.getLayout(<AuthSettingsPage />));

    const navigation = await screen.findByRole('navigation', {
      name: 'Auth settings navigation',
    });
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Sign-In Methods', `${SETTINGS_PATH}?tab=sign-in-methods`],
      ['OAuth2 Provider', `${SETTINGS_PATH}?tab=oauth2-provider`],
      ['SMTP', `${SETTINGS_PATH}?tab=smtp`],
      ['Authentication', `${SETTINGS_PATH}?tab=authentication`],
      ['Roles and Permissions', `${SETTINGS_PATH}?tab=roles-and-permissions`],
      ['JWT', `${SETTINGS_PATH}?tab=jwt`],
      ['Custom Domain', `${SETTINGS_PATH}?tab=custom-domain`],
      ['Rate Limiting', `${SETTINGS_PATH}?tab=rate-limiting`],
    ]);
    expect(
      within(navigation).getAllByRole('link', { current: 'page' }),
    ).toEqual([within(navigation).getByRole('link', { name: 'JWT' })]);
    expect(
      await screen.findByRole('heading', { name: 'JSON Web Token Settings' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'This project is paused. Unpause to make this available.',
      ),
    ).not.toBeInTheDocument();
  });

  it('navigates to the custom domain tab on mobile when self-hosted with a config server', async () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    loadProject();
    setTab('sign-in-methods', { local: true });
    const user = new TestUserEvent();
    const { rerender } = render(
      AuthSettingsPage.getLayout(<AuthSettingsPage />),
    );

    const trigger = await screen.findByRole('combobox', {
      name: 'Auth settings navigation',
    });
    expect(trigger).toHaveTextContent('Sign-In Methods');
    await screen.findByRole('heading', { name: 'Email and Password' });
    await user.click(trigger);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([
      'Sign-In Methods',
      'OAuth2 Provider',
      'SMTP',
      'Authentication',
      'Roles and Permissions',
      'JWT',
      'Custom Domain',
      'Rate Limiting',
    ]);
    await user.click(screen.getByRole('option', { name: 'Custom Domain' }));
    expect(mockRouter.push).toHaveBeenCalledOnce();
    expect(mockRouter.push).toHaveBeenCalledWith(
      `${LOCAL_SETTINGS_PATH}?tab=custom-domain`,
      undefined,
      {
        shallow: true,
        scroll: undefined,
        locale: undefined,
      },
    );
    setTab('custom-domain', { local: true });
    rerender(AuthSettingsPage.getLayout(<AuthSettingsPage />));
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Auth settings navigation' }),
      ).toHaveTextContent('Custom Domain');
    });
    expect(
      await screen.findByRole('heading', { name: 'Auth Custom Domain' }),
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
