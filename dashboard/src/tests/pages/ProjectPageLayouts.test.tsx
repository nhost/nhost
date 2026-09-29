import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import OrgProjects from '@/pages/orgs/[orgSlug]/projects';
import DeploymentDetailsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/deployments/[deploymentId]';
import SettingsGeneralPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/settings';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import {
  getOrganization,
  getOrganizations,
} from '@/tests/msw/mocks/graphql/getOrganizationQuery';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen } from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';
const SETTINGS_ROUTE = `${PROJECT_ROUTE}/settings`;
const DEPLOYMENT_ROUTE = `${PROJECT_ROUTE}/deployments/[deploymentId]`;
const originalMatchMedia = window.matchMedia;
const server = setupServer(
  tokenQuery,
  getOrganization,
  getOrganizations,
  getProjectQuery,
  getProjectStateQuery([{ stateId: ApplicationStatus.Live }]),
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

function setRoute(route: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: route,
    route,
    asPath: route
      .replace('[orgSlug]', mockOrganization.slug)
      .replace('[appSubdomain]', mockApplication.subdomain)
      .replace('[deploymentId]', 'deployment-1'),
    query: {
      orgSlug: mockOrganization.slug,
      ...(route.includes('[appSubdomain]') && {
        appSubdomain: mockApplication.subdomain,
      }),
      ...(route.includes('[deploymentId]') && {
        deploymentId: 'deployment-1',
      }),
    },
  });
}

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  await import('@/components/layout/AppSidebar');
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  window.matchMedia = originalMatchMedia;
});

afterAll(() => server.close());

describe('Project page layouts', () => {
  it('preserves the query cache when navigating from settings to a feature and back', async () => {
    setRoute(SETTINGS_ROUTE);
    const { rerender } = render(
      SettingsGeneralPage.getLayout(<h1>Settings content</h1>),
    );
    expect(
      await screen.findByRole('heading', { name: 'Settings content' }),
    ).toBeVisible();
    const projectKey = ['project', mockApplication.subdomain];
    const cachedProject = queryClient.getQueryData(projectKey);
    expect(cachedProject).toBeDefined();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    setRoute(DEPLOYMENT_ROUTE);
    rerender(DeploymentDetailsPage.getLayout(<h1>Deployment content</h1>));

    expect(
      await screen.findByRole('heading', { name: 'Deployment content' }),
    ).toBeVisible();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(projectKey)).toBe(cachedProject);

    setRoute(SETTINGS_ROUTE);
    rerender(SettingsGeneralPage.getLayout(<h1>Settings content</h1>));

    expect(
      await screen.findByRole('heading', { name: 'Settings content' }),
    ).toBeVisible();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(projectKey)).toBe(cachedProject);
  });

  it('still clears the query cache when leaving project pages', async () => {
    setRoute(SETTINGS_ROUTE);
    const { rerender } = render(
      SettingsGeneralPage.getLayout(<h1>Settings content</h1>),
    );
    expect(
      await screen.findByRole('heading', { name: 'Settings content' }),
    ).toBeVisible();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    setRoute('/orgs/[orgSlug]/projects');
    rerender(OrgProjects.getLayout(<h1>Organization content</h1>));

    expect(
      await screen.findByRole('heading', { name: 'Organization content' }),
    ).toBeVisible();
    expect(clearSpy).toHaveBeenCalledOnce();
    expect(
      queryClient.getQueryData(['project', mockApplication.subdomain]),
    ).toBeUndefined();
  });
});
