import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TreeNavStateProvider } from '@/components/layout/MainNav/TreeNavStateContext';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type GetOrganizationQuery,
  type GetOrganizationQueryVariables,
  type GetOrganizationsQuery,
  type GetOrganizationsQueryVariables,
  type ProjectFragment,
  Sla_Level_Enum,
} from '@/generated/graphql';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
  mockRouter,
} from '@/tests/mocks';
import {
  getProjectConfigErrorQuery,
  getProjectStateQuery,
  PROJECT_CONFIG_INCIDENT_ERROR_MESSAGE,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
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
  // The default export is used by useRemoveQueryParamsFromUrl.
  default: (await import('@/tests/mocks')).mockRouter,
}));

type OrganizationApplication =
  GetOrganizationsQuery['organizations'][number]['apps'][number];

const ORG_SLUG = mockOrganization.slug;
const BROKEN_SUBDOMAIN = 'broken-project';
const PROJECT_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]';
const PAGE_ERROR = new Error('Project page failed to load');
const application = (subdomain: string, name: string) =>
  ({
    __typename: 'apps',
    id: subdomain,
    name,
    slug: subdomain,
    subdomain,
    githubRepository: null,
  }) satisfies OrganizationApplication;
const healthyApplication = application('healthy-project', 'Healthy project');
const brokenApplication = application(BROKEN_SUBDOMAIN, 'Broken project');
const healthyProject = {
  ...mockApplication,
  ...healthyApplication,
} satisfies ProjectFragment;
const applications = [healthyApplication, brokenApplication];
const organization = {
  ...mockOrganization,
  apps: applications,
} satisfies GetOrganizationQuery['organizations'][number];
const organizationListItem = {
  ...organization,
  plan: {
    ...organization.plan,
    slaLevel: Sla_Level_Enum.None,
  },
} satisfies GetOrganizationsQuery['organizations'][number];
const getOrganizationsQuery = nhostGraphQLLink.query<
  GetOrganizationsQuery,
  GetOrganizationsQueryVariables
>('getOrganizations', () =>
  HttpResponse.json({ data: { organizations: [organizationListItem] } }),
);
const getOrganizationQuery = nhostGraphQLLink.query<
  GetOrganizationQuery,
  GetOrganizationQueryVariables
>('getOrganization', () =>
  HttpResponse.json({ data: { organizations: [organization] } }),
);
const emptyQuery = (operationName: string, rootField = operationName) =>
  nhostGraphQLLink.query(operationName, () =>
    HttpResponse.json({ data: { [rootField]: [] } }),
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

function ProjectIdentity() {
  const { project } = useProject();
  return project ? <p>Current project: {project.name}</p> : null;
}

function ProjectContent({ fails = false }: { fails?: boolean }) {
  if (fails) {
    throw PAGE_ERROR;
  }

  return (
    <>
      <h1>Project content</h1>
      <ProjectIdentity />
    </>
  );
}

interface TestHarnessProps {
  pageFails?: boolean;
  withSettingsLayout?: boolean;
}

function TestHarness({
  pageFails = false,
  withSettingsLayout = false,
}: TestHarnessProps) {
  const content = <ProjectContent fails={pageFails} />;

  return (
    <TreeNavStateProvider>
      <OrgLayout>
        {withSettingsLayout ? (
          <SettingsLayout>{content}</SettingsLayout>
        ) : (
          content
        )}
      </OrgLayout>
    </TreeNavStateProvider>
  );
}

async function expectProjectSwitcher(
  selectedApplication: OrganizationApplication,
) {
  const banner = await screen.findByRole('banner');
  const switcher = await waitFor(() => {
    const matchingSwitcher = within(banner)
      .getAllByRole('combobox')
      .find(({ textContent }) =>
        textContent?.includes(selectedApplication.name),
      );

    if (!matchingSwitcher) {
      throw new Error(
        `Could not find the ${selectedApplication.name} switcher`,
      );
    }

    return matchingSwitcher;
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
    emptyQuery('getAnnouncements', 'announcements'),
    emptyQuery('organizationMemberInvites'),
    emptyQuery('organizationNewRequests'),
    getProjectConfigErrorQuery({
      healthyApplication: healthyProject,
      brokenSubdomain: BROKEN_SUBDOMAIN,
    }),
    getProjectStateQuery([
      {
        id: 'state',
        appId: healthyProject.id,
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
  it('isolates project config errors and recovers the project boundary on project switch', async () => {
    const { rerender } = render(<TestHarness />);

    await expectProjectSwitcher(brokenApplication);
    expect(
      await screen.findByText(PROJECT_CONFIG_INCIDENT_ERROR_MESSAGE),
    ).toBeVisible();

    setProject(healthyApplication.subdomain);
    rerender(<TestHarness />);

    expect(
      await screen.findByRole('heading', { name: 'Project content' }),
    ).toBeVisible();
    expect(
      await screen.findByText(`Current project: ${healthyProject.name}`),
    ).toBeVisible();
    expect(
      screen.queryByText(PROJECT_CONFIG_INCIDENT_ERROR_MESSAGE),
    ).not.toBeInTheDocument();
    await expectProjectSwitcher(healthyApplication);
  });

  it('recovers the project boundary on same-project route changes', async () => {
    setProject(healthyApplication.subdomain);
    mockRouter.pathname = `${PROJECT_ROUTE}/logs`;
    mockRouter.route = `${PROJECT_ROUTE}/logs`;
    mockRouter.asPath = `/orgs/${ORG_SLUG}/projects/${healthyApplication.subdomain}/logs`;
    const { rerender } = render(<TestHarness pageFails />);

    expect(await screen.findByText(PAGE_ERROR.message)).toBeVisible();

    mockRouter.pathname = `${PROJECT_ROUTE}/metrics`;
    mockRouter.route = `${PROJECT_ROUTE}/metrics`;
    mockRouter.asPath = `/orgs/${ORG_SLUG}/projects/${healthyApplication.subdomain}/metrics`;
    rerender(<TestHarness />);

    expect(
      await screen.findByRole('heading', { name: 'Project content' }),
    ).toBeVisible();
    expect(screen.queryByText(PAGE_ERROR.message)).not.toBeInTheDocument();
  });

  it('recovers the settings boundary on same-project route changes', async () => {
    setProject(healthyApplication.subdomain);
    mockRouter.pathname = `${PROJECT_ROUTE}/settings`;
    mockRouter.route = `${PROJECT_ROUTE}/settings`;
    mockRouter.asPath = `/orgs/${ORG_SLUG}/projects/${healthyApplication.subdomain}/settings`;
    const { rerender } = render(<TestHarness pageFails withSettingsLayout />);

    expect(await screen.findByText(PAGE_ERROR.message)).toBeVisible();

    mockRouter.pathname = `${PROJECT_ROUTE}/settings/storage`;
    mockRouter.route = `${PROJECT_ROUTE}/settings/storage`;
    mockRouter.asPath = `/orgs/${ORG_SLUG}/projects/${healthyApplication.subdomain}/settings/storage`;
    rerender(<TestHarness withSettingsLayout />);

    expect(
      await screen.findByRole('heading', { name: 'Project content' }),
    ).toBeVisible();
    expect(screen.queryByText(PAGE_ERROR.message)).not.toBeInTheDocument();
  });
});
