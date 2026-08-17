import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import HeaderNavigation from '@/components/layout/Header/HeaderNavigation';
import {
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  Sla_Level_Enum,
} from '@/generated/graphql';
import { mockApplication, mockOrganization, mockRouter } from '@/tests/mocks';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));

vi.mock('next/router', async () => ({
  useRouter: mocks.useRouter,
  default: (await import('@/tests/mocks')).mockRouter,
}));

const otherProject = {
  ...mockApplication,
  __typename: 'apps' as const,
  id: 'other-project',
  name: 'Other Project',
  slug: 'other-project',
  subdomain: 'other-project',
  githubRepository: null,
};
const organization = {
  ...mockOrganization,
  plan: { ...mockOrganization.plan, slaLevel: Sla_Level_Enum.None },
  apps: [
    {
      ...mockApplication,
      __typename: 'apps' as const,
      githubRepository: null,
    },
    otherProject,
  ],
};
const otherOrganization = {
  ...organization,
  id: 'other-org',
  name: 'Other organization',
  slug: 'other-org',
  apps: [],
};

const server = setupServer(
  tokenQuery,
  nhostGraphQLLink.query<GetOrganizationsQuery, GetOrganizationsQueryVariables>(
    'getOrganizations',
    () =>
      HttpResponse.json({
        data: { organizations: [organization, otherOrganization] },
      }),
  ),
  getProjectQuery,
  getProjectStateQuery(),
);
const originalRouter = { ...mockRouter, query: { ...mockRouter.query } };

function setRoute(appSubdomain?: string, featurePath = '') {
  const orgPath = `/orgs/${organization.slug}/projects`;
  mockRouter.query = {
    orgSlug: organization.slug,
    ...(appSubdomain ? { appSubdomain } : {}),
  };
  mockRouter.pathname = appSubdomain
    ? `/orgs/[orgSlug]/projects/[appSubdomain]${featurePath}`
    : '/orgs/[orgSlug]/projects';
  mockRouter.route = mockRouter.pathname;
  mockRouter.asPath = appSubdomain
    ? `${orgPath}/${appSubdomain}${featurePath}`
    : orgPath;
}

describe('HeaderNavigation', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
    mockPointerEvent();
    window.localStorage.clear();
    setRoute();
    mocks.useRouter.mockReturnValue(mockRouter);
    vi.mocked(mockRouter.push).mockClear();
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    Object.assign(mockRouter, originalRouter);
    mocks.useRouter.mockReset();
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  afterAll(() => server.close());

  it('renders the project selector only when appSubdomain exists', async () => {
    const { rerender } = render(<HeaderNavigation />);

    expect(
      await screen.findByRole('link', { name: /Test organization/ }),
    ).toHaveAttribute('href', `/orgs/${organization.slug}/projects`);
    expect(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('combobox', { name: 'Switch project' }),
    ).not.toBeInTheDocument();

    setRoute(mockApplication.subdomain);
    rerender(<HeaderNavigation />);

    expect(
      await screen.findByRole('link', { name: mockApplication.name }),
    ).toHaveAttribute(
      'href',
      `/orgs/${organization.slug}/projects/${mockApplication.subdomain}`,
    );
    expect(
      screen.getByRole('combobox', { name: 'Switch project' }),
    ).toBeVisible();

    setRoute();
    rerender(<HeaderNavigation />);

    expect(
      screen.queryByRole('combobox', { name: 'Switch project' }),
    ).not.toBeInTheDocument();
  });

  it('navigates to the selected organization projects', async () => {
    const user = new TestUserEvent();
    render(<HeaderNavigation />);

    await user.click(
      screen.getByRole('combobox', { name: 'Switch organization' }),
    );
    await user.click(
      await screen.findByRole('option', { name: /Other organization/ }),
    );

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/orgs/${otherOrganization.slug}/projects`,
    );
  });

  it('switches projects while preserving the current feature page', async () => {
    setRoute(mockApplication.subdomain, '/auth/users');
    const user = new TestUserEvent();
    render(<HeaderNavigation />);

    await user.click(screen.getByRole('combobox', { name: 'Switch project' }));
    await user.click(
      await screen.findByRole('option', { name: otherProject.name }),
    );

    expect(mockRouter.push).toHaveBeenCalledWith(
      `/orgs/${organization.slug}/projects/${otherProject.subdomain}/auth/users`,
    );
  });

  it.each([undefined, mockApplication.subdomain])(
    'hides header navigation on self-hosted dashboards (appSubdomain: %s)',
    (appSubdomain) => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      setRoute(appSubdomain);
      render(<HeaderNavigation />);

      expect(
        screen.queryByRole('navigation', { name: 'Header navigation' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: 'Switch organization' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('combobox', { name: 'Switch project' }),
      ).not.toBeInTheDocument();
    },
  );
});
