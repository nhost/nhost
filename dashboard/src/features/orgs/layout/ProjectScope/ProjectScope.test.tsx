import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';
import { OrganizationScope } from '@/features/orgs/layout/OrganizationScope';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetOrganizationQuery,
  type GetOrganizationQueryVariables,
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  type GetProjectQuery,
  type GetProjectQueryVariables,
  Organization_Status_Enum,
  Sla_Level_Enum,
} from '@/generated/graphql';
import { AuthContext } from '@/providers/Auth';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import { getProjectStateQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import ProjectScope from './ProjectScope';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));
vi.mock('next/router', async () => ({
  useRouter: mocks.useRouter,
  default: (await import('@/tests/mocks')).mockRouter,
}));

const ORG_SLUG = mockOrganization.slug;
const BROKEN_SUBDOMAIN = 'broken-project';
const HEALTHY_SUBDOMAIN = 'healthy-project';
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';
const CONFIG_ERROR =
  'failed to resolve config: failed to validate config: #Config.functions.node.version';

const organizationApplication = (subdomain: string, name: string) => ({
  ...mockApplication,
  __typename: 'apps' as const,
  id: subdomain,
  name,
  slug: subdomain,
  subdomain,
  githubRepository: null,
});

const healthyApplication = organizationApplication(
  HEALTHY_SUBDOMAIN,
  'Healthy project',
);
const brokenApplication = organizationApplication(
  BROKEN_SUBDOMAIN,
  'Broken project',
);
const applications = [healthyApplication, brokenApplication];

const getOrganizationsQuery = nhostGraphQLLink.query<
  GetOrganizationsQuery,
  GetOrganizationsQueryVariables
>('getOrganizations', () =>
  HttpResponse.json({
    data: {
      organizations: [
        {
          ...mockOrganization,
          apps: applications,
          plan: {
            ...mockOrganization.plan,
            slaLevel: Sla_Level_Enum.None,
          },
        },
      ],
    },
  }),
);

const getOrganizationQuery = nhostGraphQLLink.query<
  GetOrganizationQuery,
  GetOrganizationQueryVariables
>('getOrganization', () =>
  HttpResponse.json({
    data: {
      organizations: [{ ...mockOrganization, apps: applications }],
    },
  }),
);

const getProjectQuery = nhostGraphQLLink.query<
  GetProjectQuery,
  GetProjectQueryVariables
>('getProject', ({ variables }) =>
  variables.subdomain === BROKEN_SUBDOMAIN
    ? HttpResponse.json({ errors: [{ message: CONFIG_ERROR }] })
    : HttpResponse.json({ data: { apps: [healthyApplication] } }),
);

const getAnnouncementsQuery = nhostGraphQLLink.query('getAnnouncements', () =>
  HttpResponse.json({ data: { announcements: [] } }),
);
const getOrganizationMemberInvitesQuery = nhostGraphQLLink.query(
  'organizationMemberInvites',
  () => HttpResponse.json({ data: { organizationMemberInvites: [] } }),
);
const getOrganizationNewRequestsQuery = nhostGraphQLLink.query(
  'organizationNewRequests',
  () => HttpResponse.json({ data: { organizationNewRequests: [] } }),
);

function setOrganizationStatus(status: Organization_Status_Enum) {
  server.use(
    nhostGraphQLLink.query<GetOrganizationQuery, GetOrganizationQueryVariables>(
      'getOrganization',
      () =>
        HttpResponse.json({
          data: {
            organizations: [
              { ...mockOrganization, apps: applications, status },
            ],
          },
        }),
    ),
  );
}

const server = setupServer(tokenQuery);
const originalRouter = { ...mockRouter, query: { ...mockRouter.query } };
const originalMatchMedia = window.matchMedia;

function setProject(subdomain: string) {
  mockRouter.pathname = PROJECT_ROUTE;
  mockRouter.route = PROJECT_ROUTE;
  mockRouter.asPath = `/orgs/${ORG_SLUG}/projects/${subdomain}`;
  mockRouter.query = { orgSlug: ORG_SLUG, appSubdomain: subdomain };
}

function ProjectContent() {
  const { project } = useProject();

  return project ? <h1>Current project: {project.name}</h1> : null;
}

function TestHarness() {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectContent />
      </ProjectScope>
    </AppLayout>
  );
}

// The header shows the selected project as a link to its overview, with the
// switcher itself as an icon-only combobox next to it.
async function expectProjectSwitcher(selectedProjectName: string) {
  const banner = await screen.findByRole('banner');

  expect(
    await within(banner).findByRole('link', { name: selectedProjectName }),
  ).toBeVisible();

  const user = new TestUserEvent();
  await user.click(
    within(banner).getByRole('combobox', { name: 'Switch project' }),
  );
  expect(
    await screen.findByRole('option', { name: /Healthy project/ }),
  ).toBeVisible();
  expect(
    await screen.findByRole('option', { name: /Broken project/ }),
  ).toBeVisible();
  await user.keyboard('{Escape}');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mockPointerEvent();
  setProject(BROKEN_SUBDOMAIN);
  mocks.useRouter.mockReturnValue(mockRouter);
  server.use(
    getOrganizationQuery,
    getOrganizationsQuery,
    getProjectQuery,
    getAnnouncementsQuery,
    getOrganizationMemberInvitesQuery,
    getOrganizationNewRequestsQuery,
    getProjectStateQuery([
      {
        id: 'state',
        appId: healthyApplication.id,
        message: '',
        stateId: ApplicationStatus.Live,
        createdAt: '2026-08-11T00:00:00.000Z',
      },
    ]),
  );
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  Object.assign(mockRouter, originalRouter);
  mocks.useRouter.mockReset();
  vi.unstubAllEnvs();
  window.matchMedia = originalMatchMedia;
});

afterAll(() => server.close());

it('keeps the header and sidebar visible while auth loads, but hides page content', () => {
  render(
    <AuthContext.Provider
      value={{
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true,
        isSigningOut: false,
        signout: vi.fn(async () => {}),
        updateSession: vi.fn(),
        clearIsSigningOut: vi.fn(),
      }}
    >
      <AppLayout>
        <AuthGuard>
          <h1>Protected page content</h1>
        </AuthGuard>
      </AppLayout>
    </AuthContext.Provider>,
  );

  expect(screen.getByRole('banner')).toBeVisible();
  expect(
    screen.getByRole('navigation', { name: 'Project navigation' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Protected page content' }),
  ).not.toBeInTheDocument();
});

describe.each([
  { name: 'OrganizationScope', Scope: OrganizationScope },
  { name: 'ProjectScope', Scope: ProjectScope },
])('$name banner layout', ({ name, Scope }) => {
  it.each([
    { status: Organization_Status_Enum.Ok, banner: null },
    {
      status: Organization_Status_Enum.AllowanceExceeded,
      banner: 'Usage limit has been exceeded for this organization',
    },
    {
      status: Organization_Status_Enum.Cancelled,
      banner:
        'Subscription is cancelled after multiple failed billing attempts',
    },
  ])(
    'reserves the remaining height for content when status is $status',
    async ({ status, banner }) => {
      setProject(HEALTHY_SUBDOMAIN);
      if (name === 'OrganizationScope') {
        mockRouter.pathname = '/orgs/[orgSlug]/projects';
        mockRouter.route = '/orgs/[orgSlug]/projects';
        mockRouter.asPath = `/orgs/${ORG_SLUG}/projects`;
        mockRouter.query = { orgSlug: ORG_SLUG };
      }
      setOrganizationStatus(status);

      render(
        <AppLayout>
          <Scope>
            <div className="h-full" data-testid="page-content">
              Page content
            </div>
          </Scope>
        </AppLayout>,
      );

      const page = await screen.findByTestId('page-content');
      const main = screen.getByRole('main');
      const content = page.parentElement;

      expect(main).toHaveClass('flex', 'flex-col', 'overflow-y-auto');
      expect(content).toHaveClass('relative', 'min-h-0', 'flex-1');
      expect(content?.parentElement).toBe(main);

      if (banner) {
        const heading = within(main).getByRole('heading', { name: banner });
        const statusBanner = heading.parentElement?.parentElement;

        expect(statusBanner).toHaveClass('shrink-0');
        expect(content?.previousElementSibling).toBe(statusBanner);
      } else {
        expect(main.children).toHaveLength(1);
      }
    },
  );
});

describe('ProjectScope', () => {
  it('keeps a paused-project screen in the remaining-height content area', async () => {
    setProject(HEALTHY_SUBDOMAIN);
    mockRouter.pathname = `${PROJECT_ROUTE}/graphql`;
    mockRouter.route = `${PROJECT_ROUTE}/graphql`;
    mockRouter.asPath += '/graphql';
    setOrganizationStatus(Organization_Status_Enum.AllowanceExceeded);
    server.use(
      getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
        desiredState: ApplicationStatus.Paused,
      }),
      nhostGraphQLLink.query('GetFreeAndActiveProjects', () =>
        HttpResponse.json({ data: { freeAndActiveProjects: [] } }),
      ),
      nhostGraphQLLink.query('getProjectIsLocked', () =>
        HttpResponse.json({
          data: { app: { isLocked: false, isLockedReason: '' } },
        }),
      ),
    );

    render(
      <AppLayout>
        <ProjectScope>
          <ProjectViewWithState>
            <h1>Project content</h1>
          </ProjectViewWithState>
        </ProjectScope>
      </AppLayout>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Project State' });
    const main = screen.getByRole('main');
    const content = main.lastElementChild;

    expect(content).toHaveClass('relative', 'min-h-0', 'flex-1');
    expect(content).toContainElement(dialog);
    expect(content?.firstElementChild).toHaveClass('h-full');
    expect(
      within(main).getByRole('heading', {
        name: 'Usage limit has been exceeded for this organization',
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Project content' }),
    ).not.toBeInTheDocument();
  });

  it('keeps navigation available and recovers when another project has a config error', async () => {
    const { rerender } = render(<TestHarness />);

    await expectProjectSwitcher(brokenApplication.name);
    expect(await screen.findByText(CONFIG_ERROR)).toBeVisible();

    setProject(HEALTHY_SUBDOMAIN);
    rerender(<TestHarness />);

    expect(
      await screen.findByRole('heading', {
        name: `Current project: ${healthyApplication.name}`,
      }),
    ).toBeVisible();
    expect(screen.queryByText(CONFIG_ERROR)).not.toBeInTheDocument();
    await expectProjectSwitcher(healthyApplication.name);
  });
});
