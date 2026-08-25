import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TreeNavStateProvider } from '@/components/layout/MainNav/TreeNavStateContext';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetOrganizationQuery,
  type GetOrganizationQueryVariables,
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  type GetProjectQuery,
  type GetProjectQueryVariables,
  Sla_Level_Enum,
} from '@/generated/graphql';
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
  waitFor,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';
import OrgLayout from './OrgLayout';

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
    <TreeNavStateProvider>
      <OrgLayout>
        <ProjectContent />
      </OrgLayout>
    </TreeNavStateProvider>
  );
}

async function expectProjectSwitcher(selectedProjectName: string) {
  const banner = await screen.findByRole('banner');
  const switcher = await waitFor(() => {
    const match = within(banner)
      .getAllByRole('combobox')
      .find(({ textContent }) => textContent?.includes(selectedProjectName));

    if (!match) {
      throw new Error(`Could not find the ${selectedProjectName} switcher`);
    }

    return match;
  });

  const user = new TestUserEvent();
  await user.click(switcher);
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

describe('OrgLayout', () => {
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
